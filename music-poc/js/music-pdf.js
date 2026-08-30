// music-pdf.js
// The PDF orchestrator for the Accessible Music proof of concept (Stage 20).
//
// This module re-homes the proven Phase 4 and 5 spike pipeline into a real module that
// drives the real Stage 15 builder. It owns the whole-page flow: it asks Verovio
// to paginate a break-injected score onto pages whose size and staff unit come
// from a named engraving profile, embeds each page as a vector SVG, then
// assembles the pages into a genuine multi-page tagged PDF via typst.ts,
// embedding the original MusicXML as an attachment. Threading a profile name
// selects standard or large-print engraving from one pipeline. The pure document
// SOURCE (pagination breaks, multi-page markup, %PDF magic check) lives in
// js/music-pdf-markup.js; this module supplies the BROWSER mechanism around it
// (Verovio, typst.ts compile). Every proven primitive here is lifted verbatim
// from the Phase 4 and 5 spikes, since removed, narrowed to the validated
// engraving norm; the record of what those spikes established is
// music-poc/docs/poc-plan-phase-4.md and poc-plan-phase-5.md.
// The whole runtime needs the browser; under node only `node --check` and
// the pure-builder selfTest rows are meaningful. Exposed as globalThis.MusicPdf.

const MusicPdf = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The production path embeds vector SVG and never rasterises. The PNG
  // primitive that used to sit beside this file was removed once the vector
  // route served both profiles and nothing called it; a PNG-versus-SVG
  // comparison would now have to be rebuilt from scratch rather than revived.

  // Proven, pinned constants, lifted verbatim from the spike so the mechanism is
  // identical to the validated path.
  const TYPST_MODULE_URL =
    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst.ts@0.7.0/dist/esm/contrib/all-in-one-lite.bundle.js";
  const TYPST_WASM_URL =
    "https://cdn.jsdelivr.net/npm/@myriaddreamin/typst-ts-web-compiler@0.7.0/pkg/typst_ts_web_compiler_bg.wasm";
  const MAIN = "/main.typ"; // absolute main .typ path the spike compiles with
  const FORMAT_PDF = 1; // CompileFormatEnum.pdf
  const ATTACH_PATH = "/assets/score.musicxml"; // absolute vfs path for the source
  const MUSICXML_MIME = "application/vnd.recordare.musicxml+xml";
  const DOC_LANG = "en";
  const DEFAULT_TITLE = "Accessible Music score"; // British fallback when workTitle absent

  // The image-description levels, as a frozen enum rather than bare strings. The
  // VALUES are the radio values in music-poc/index.html and the two must agree; the
  // page's radio group is the only producer, and generate is the only consumer.
  //   pages         — the positional default alt on every page. The shipped
  //                   behaviour since the PDF existed, and still the default.
  //   summary       — the whole-piece summary as page 1's alt, later pages
  //                   unchanged (Stage 82).
  //   talking-score — EVERY page's alt describes that page's own music, composed
  //                   from the positional prefix and MusicDescribeSpan's summary
  //                   of the bars Verovio actually laid out on it (Stage 83, this
  //                   stage). A page whose bar range cannot be established keeps
  //                   the positional default, so the level degrades per page
  //                   rather than all at once.
  const ALT_TEXT_LEVELS = Object.freeze({
    PAGES: "pages",
    SUMMARY: "summary",
    TALKING_SCORE: "talking-score",
  });
  const KNOWN_ALT_TEXT_LEVELS = Object.freeze([
    ALT_TEXT_LEVELS.PAGES,
    ALT_TEXT_LEVELS.SUMMARY,
    ALT_TEXT_LEVELS.TALKING_SCORE,
  ]);
  const DEFAULT_ALT_TEXT_LEVEL = ALT_TEXT_LEVELS.PAGES;

  // The separator between a page's positional identity and the summary prose that
  // follows it at level 2. Named because it is the whole of the "the page identity
  // survives" decision: the alt reads "Score, page 1 of 2. This piece has …", so a
  // screen-reader user still learns where they are before the description starts.
  const PAGE_ALT_JOIN = ". ";

  // Consumer-side span description: the level-3 alts are composed from
  // MusicDescribeSpan, which is loaded before this file in index.html but is not
  // guaranteed to be there. EVERY method this module calls must be declared in the
  // stub, on the same terms as the walk and names stubs in music-describe-span.js:
  // a method called but not stubbed defeats the point of having one. spanSummary
  // returns null, which is the value the composer already reads as "this page has
  // no description", so an absent module lands on the positional default rather
  // than in a special case.
  //
  // Resolved at CALL time by describeSpanSvc(), not captured at module scope: it
  // matches how generate already reaches MusicPdfMarkup and MusicRenderSummary,
  // and a module-scope capture would freeze an absent service for the life of the
  // page even if it loaded a moment later.
  const SPAN_STUB = Object.freeze({
    spanSummary() {
      return null;
    },
  });
  function describeSpanSvc() {
    return globalThis.MusicDescribeSpan || SPAN_STUB;
  }

  // Consumer-side note-list outline: the Stage 84 talking-score appendix is built
  // from MusicRenderText.outlineOf, which is loaded before this file in index.html
  // but is not guaranteed to be there. Same terms as SPAN_STUB above: EVERY method
  // this module calls is declared, and outlineOf returns null — the value the
  // markup builder already reads as "no appendix" — so an absent module lands on
  // the document level 1 would have produced rather than in a special case.
  //
  // There is deliberately NO detached-<div> fallback of the kind the summary keeps.
  // Scraping 1,190 list items back out of a rendered DOM is real cost and real
  // fidelity risk for a feature whose absence is harmless, and this module is meant
  // to touch no DOM at all. An absent module, or a module predating outlineOf,
  // simply produces no appendix.
  const TEXT_STUB = Object.freeze({
    outlineOf() {
      return null;
    },
  });
  function renderTextSvc() {
    const svc = globalThis.MusicRenderText;
    return svc && typeof svc.outlineOf === "function" ? svc : TEXT_STUB;
  }

  // The MEI shapes the page-to-bars join reads. Held as named constants because
  // each encodes something MEASURED on the pinned 6.2.0 build rather than assumed.
  //
  // MEI_MEASURE_TAG matches an opening <measure> tag and nothing else. The
  // lookahead is what stops it matching <measureRest> and friends; a plain \b
  // would not, since "measure" runs straight into "Rest" with no word boundary
  // between them.
  //
  // THE TWO ATTRIBUTE PATTERNS ARE SEPARATE ON PURPOSE, and this is a trap the
  // Stage 80 spike record does not carry. Attribute ORDER IS NOT FIXED: measured
  // on Satie, bar 1 emits `<measure xml:id="h1bipq8o" n="1">` while bar 47 emits
  // `<measure xml:id="qk7eduv" right="end" n="47">`. A single pattern expecting
  // xml:id and n to be adjacent would silently drop the last bar of the piece —
  // and dropping a bar reads as a slightly shorter page range, not as an error.
  // Each attribute is therefore matched independently within the tag, anchored on
  // a preceding space or the tag start so `n=` cannot match the tail of another
  // attribute name.
  const MEI_MEASURE_TAG = /<measure(?=[\s/>])[^>]*>/g;
  const MEI_XML_ID_ATTR = /(?:^|\s)xml:id="([^"]*)"/;
  const MEI_N_ATTR = /(?:^|\s)n="([^"]*)"/;

  // The sentinel for a bar number that cannot be joined to exactly one model
  // index — absent from the model, or carried by more than one bar. Negative so
  // the single `typeof idx !== "number" || idx < 0` test at the point of use
  // catches it alongside a plain lookup miss.
  const AMBIGUOUS_INDEX = -1;

  // The vendored Leipzig SMuFL font, handed to the typst compiler so the music
  // glyphs Verovio emits as <text> resolve in the PDF (see registerLeipzig below).
  //
  // The path is DOCUMENT-relative, not script-relative: fetch() in a classic script
  // resolves against the document base, and the page is served from the REPO ROOT as
  // /music-poc/index.html, so this reaches /music-poc/fonts/Leipzig.ttf. A leading
  // slash would hard-code the folder name; "../" would wrongly escape to the root.
  //
  // Vendored rather than fetched from a CDN for two reasons: it stays byte-matched to
  // the pinned Verovio wasm above, so the glyph coverage cannot drift out from under
  // us on someone else's release; and the demo keeps working offline, which a CDN
  // fetch on the PDF path would quietly break. Provenance, the SHA-256 and the OFL
  // obligations are in music-poc/fonts/README.md.
  const LEIPZIG_FONT_URL = "fonts/Leipzig.ttf";

  // Engraving profiles for the PDF, keyed by profile name. Each holds the Verovio
  // options that set the staff SIZE; the shared layout options are the same for
  // every profile. Fine-tune large print by editing these labelled numbers.
  //
  // Why these levers and not scale: each page is placed at width:100% in the
  // Typst markup, so Typst fits every page SVG to the page width, and the staff
  // size on the final PDF is the staff height RELATIVE TO the Verovio page width.
  //   - unit sets the staff size directly, but Verovio caps it: the real range is
  //     4.5 to 12.0, and a value outside reverts SILENTLY to 9. Twelve is the
  //     largest staff the unit alone can give.
  //   - pageWidth/pageHeight break past that cap: a NARROWER Verovio page makes
  //     the same staff a larger fraction of the width, which the width-fit then
  //     enlarges. Keep height with width at roughly the 1.41 A4 ratio so each
  //     page holds its shape while the staff grows.
  //   - scale is RETIRED: it resizes the whole SVG with the same music, so the
  //     width-fit cancels it. It did nothing on the old standard PDF either.
  //   - line widths are optional refinements, set only where a profile lists
  //     them; a profile that omits them keeps Verovio's defaults.
  //
  // A STAFF HEIGHT IN MILLIMETRES IS A FIGURE ABOUT THE PRINTED PAGE, AND THE
  // VEROVIO PAGE IS NOT THE PRINTED PAGE. The markup places each page SVG at
  // width:100% on a Typst `#set page(paper: "a4")` whose margins are left at
  // Typst's own default — 2.5/21 of the short edge, i.e. 25.0 mm a side — so the
  // image lands in a content box measured at 453.5433 pt, which is 160.0 mm
  // exactly. The Verovio page width in pageWidth's 0.1 mm units is therefore a
  // NOMINAL width that the width-fit rescales; it is not what the reader holds.
  //   staff_mm = (80 x unit / pageWidth) x 160.0
  // Stage 89 measured 160.0 mm by compiling `#set page(paper:"a4")` with a
  // `#rect(width: 100%)` through this same pinned typst.ts 0.7.0 and reading the
  // laid-out box. Anything quoting a staff height without that content width is
  // quoting the nominal figure — see the Stage 89 record in
  // music-poc/docs/backlog-clearance-plan.md.
  const ENGRAVING_PROFILES = {
    // standard: A4 at the Verovio default unit. pageWidth/pageHeight are A4 in
    // 0.1 mm units (210 x 297 mm); unit 9 is the Verovio default, so this matches
    // the current standard PDF once scale is dropped. No line widths: defaults.
    standard: { pageWidth: 2100, pageHeight: 2970, unit: 9 },
    // large-print: a narrower 120 x 170 mm NOMINAL page (roughly A4 ratio) at the
    // unit cap of 12. CORRECTED AT STAGE 89: this said "a staff of about 9 to
    // 10 mm", and that figure is the staff on Verovio's OWN 120 mm page, not on
    // the printed one. The printed staff measures 12.80 mm, established by three
    // agreeing routes (SVG arithmetic on the definition-scale viewBox, DOM
    // bounding rects, and an end-to-end measurement of the placed image inside
    // the composed Typst page). 80 x 12 / 1200 = 0.08 of the page width; 0.08 x
    // 120 mm nominal = 9.6 mm, and the width-fit to the 160.0 mm content box
    // multiplies that by exactly 4/3 to 12.80 mm. The superseded figure is kept
    // here because it is a correct reading of the wrong page, which is a mistake
    // worth being able to recognise again.
    //
    // THE THREE LINE WIDTHS BELOW ARE VEROVIO 6.2.0'S OWN DEFAULTS AND ARE
    // THEREFORE INERT. Read off a toolkit with no options set: staffLineWidth
    // 0.15, barLineWidth 0.3, stemWidth 0.2 — the same three values. Stage 89
    // proved it by disable-and-remeasure: rendering with and without them gives
    // a byte-identical SVG once Verovio's random per-load xml:ids are
    // normalised, with same-options-twice as the positive control and 0.30 /
    // 0.60 / 0.40 and 0.22 / 0.44 / 0.30 as two negative controls that both
    // move the output. So the earlier note that "slightly heavier lines aid
    // low-vision reading" described an intention this block does not carry out.
    // They are KEPT, not deleted, as the seam a real thickness choice lands on
    // at Stage C of the customisation plan; a value that differs from the
    // default is what will make them do something.
    "large-print": {
      pageWidth: 1200,
      pageHeight: 1700,
      unit: 12,
      staffLineWidth: 0.15,
      barLineWidth: 0.3,
      stemWidth: 0.2,
    },
  };
  const DEFAULT_ENGRAVING_PROFILE = "standard";

  // Shared layout options, identical for every profile: page geometry stays full
  // height, Verovio honours the encoded SYSTEM breaks but paginates the pages
  // itself to the fixed page height (so no multi-staff system overflows or is
  // clipped, whatever the staff count), the systems are justified to fill the
  // page, no running header or footer, and even 100-unit margins. Under "line"
  // Verovio ignores the encoded PAGE breaks, so those are retired from the markup
  // in a separate stage. The profile supplies page size and staff unit on top of
  // this; scale is not included here or in any profile (retired — the width-fit
  // cancels it).
  const SHARED_ENGRAVING = {
    adjustPageHeight: false, // keep each page a full page height
    breaks: "line", // honour encoded system breaks; Verovio paginates to page height (page breaks ignored)
    justifyVertically: true, // spread the systems to fill the page height
    // Measure numbers at the start of every system. mnumInterval is the
    // confirmed measure-number frequency option (Verovio 6.2.0 toolkit-options
    // docs); 0 is its default-rule value. UNCONFIRMED: the docs do not state
    // the default value nor explicitly confirm 0 prints at each system start.
    // Matthew sees in the PDF whether numbers print; if none appear, try 1.
    mnumInterval: 0,
    // Omit the SVG's own @font-face for the SMuFL text glyphs, so the font arrives
    // from the typst compiler alone (see registerLeipzig). With Leipzig registered
    // there, two sources for one font is worse than one: both would work, and nobody
    // reading the code or a failure later could tell which one was load-bearing.
    // Arm E2 proved this exact combination — registered font plus "linked" — embeds
    // Leipzig in the PDF with the SVG carrying no @font-face rule of its own.
    smuflTextFont: "linked",
    header: "none",
    footer: "none",
    pageMarginTop: 100,
    pageMarginBottom: 100,
    pageMarginLeft: 100,
    pageMarginRight: 100,
  };

  // THE OVERRIDE SEAM (Stage 90). Verovio option names an override may carry
  // BEYOND the two blocks above. The allowed set is otherwise DERIVED — the keys
  // of SHARED_ENGRAVING plus the keys of the chosen profile entry — so a
  // customisation control may re-point an option one of the named blocks already
  // sets without any list being maintained by hand.
  //
  // WHY AN ALLOW-LIST AT ALL, rather than passing the override object straight to
  // setOptions. VEROVIO TAKES AN UNLISTED OPTION SILENTLY AND KEEPS THE DEFAULT —
  // measured at Stage 70, where "ignored" was passed to smuflTextFont, whose
  // permitted set is embedded, linked and none, and nothing anywhere reported it.
  // So a typo in a future control would engrave the unchanged document and report
  // success. Dropping the key here with a warn makes the same mistake audible.
  //
  // WHY THIS LIST HAS EXACTLY ONE ENTRY, and why it is not longer. `scale` is a
  // Verovio option this project has used and DELIBERATELY RETIRED (the width-fit
  // to the Typst content box cancels it — see the profile comment above), so it is
  // a name verified against this pinned 6.2.0 build that no block sets. Every
  // other Verovio option name that could go here would be recalled rather than
  // measured, and an unverified name in an allow-list is the inert declaration
  // Stage 89 spent a stage correcting. A Stage 91 control that needs a new name
  // adds it HERE, with a toolkit read-back proving Verovio accepted it — the
  // read-back js/music-raster.js already performs for its own options.
  const KNOWN_EXTRA_ENGRAVING_KEYS = ["scale"];

  // The ONE profile whose engraving and pagination may be overridden. The standard
  // PDF is the comparison baseline every recorded page count and every byte-level
  // identity check refers to, so it stays reachable by exactly one route: an
  // override aimed at it is refused, not merged. See profileOverridesFrom.
  const OVERRIDABLE_PROFILE = "large-print";

  // unknownOverrideKeys(overrides, allowed) → the override key names NOT in the
  // allowed set, in the order the caller wrote them. PURE, and the list the warn
  // below names, so selfTest can assert what the warn would say without having to
  // intercept a logger the IIFE captured at load.
  function unknownOverrideKeys(overrides, allowed) {
    if (!overrides) return [];
    const unknown = [];
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i++) {
      if (allowed.indexOf(keys[i]) === -1) unknown.push(keys[i]);
    }
    return unknown;
  }

  // acceptedOverrides(overrides, allowed) → a FRESH object carrying only the
  // allowed keys. Absent or empty overrides give an empty object, which is why an
  // absent-override call merges a third term that changes nothing. PURE.
  function acceptedOverrides(overrides, allowed) {
    const accepted = {};
    if (!overrides) return accepted;
    const keys = Object.keys(overrides);
    for (let i = 0; i < keys.length; i++) {
      if (allowed.indexOf(keys[i]) !== -1) accepted[keys[i]] = overrides[keys[i]];
    }
    return accepted;
  }

  // engravingOptionsFor(profile, overrides) → the merged Verovio options for a
  // profile. Pure: it touches no toolkit and no DOM. An undefined or empty profile
  // falls back to standard silently; an unknown string logWarns then falls back.
  // The result is a fresh object so callers cannot mutate the shared blocks.
  //
  // overrides is optional and is the Stage 90 seam. It is merged as the THIRD term
  // of one Object.assign onto a fresh `{}`, so neither SHARED_ENGRAVING nor the
  // profile entry is ever written — the blocks are read, never assigned into.
  // Absent or empty overrides make that third term an empty object, so the result
  // is byte-identical to the two-term merge this function performed before this
  // stage; that identity is proved by execution rather than argued (see selfTest,
  // and the Stage 90 record in music-poc/docs/backlog-clearance-plan.md).
  function engravingOptionsFor(profile, overrides) {
    let key = profile || DEFAULT_ENGRAVING_PROFILE;
    if (!ENGRAVING_PROFILES[key]) {
      logWarn(
        "Unknown engraving profile '" + profile + "'; falling back to '" + DEFAULT_ENGRAVING_PROFILE + "'"
      );
      key = DEFAULT_ENGRAVING_PROFILE;
    }
    const entry = ENGRAVING_PROFILES[key];
    const allowed = Object.keys(SHARED_ENGRAVING)
      .concat(Object.keys(entry))
      .concat(KNOWN_EXTRA_ENGRAVING_KEYS);
    const unknown = unknownOverrideKeys(overrides, allowed);
    if (unknown.length) {
      logWarn(
        "Dropping unknown engraving override key(s): " + unknown.join(", ")
      );
    }
    return Object.assign({}, SHARED_ENGRAVING, entry, acceptedOverrides(overrides, allowed));
  }

  // profileOverridesFrom(options, profile) → { engraving, pagination }, each an
  // override object or null. PURE: no toolkit, no DOM, so selfTest drives it
  // directly.
  //
  // THE LARGE-PRINT-ONLY RULE, and why it is a refusal rather than a filter. The
  // standard PDF is what every recorded page count, every comparison baseline and
  // the Stage 89 measurements describe, and Stage 91 is putting controls on the
  // large-print document alone. Refusing an override aimed at standard makes "the
  // standard button is unchanged" provable from this function rather than resting
  // on nobody wiring a control to it — a guarantee by construction, which is the
  // only kind that survives a future caller.
  //
  // The refusal warns, because a control that silently did nothing would look
  // exactly like a control that worked. Absent overrides return the null pair with
  // NO warning, so every existing three- and four-argument call is unchanged.
  function profileOverridesFrom(options, profile) {
    const engraving = (options && options.engraving) || null;
    const pagination = (options && options.pagination) || null;
    if (!engraving && !pagination) return { engraving: null, pagination: null };
    if (profile !== OVERRIDABLE_PROFILE) {
      logWarn(
        "Engraving and pagination overrides are honoured at the '" +
          OVERRIDABLE_PROFILE +
          "' profile only; dropping them for profile '" +
          (profile || DEFAULT_ENGRAVING_PROFILE) +
          "'"
      );
      return { engraving: null, pagination: null };
    }
    return { engraving: engraving, pagination: pagination };
  }

  // altTextLevelFrom(options) → the resolved image-description level. PURE: no
  // DOM, no toolkit, so selfTest exercises it directly. Absent options, an absent
  // altTextLevel and an empty one all resolve to the default with NO warning (a
  // three-argument call is the supported "just give me the shipped behaviour");
  // an unknown string logWarns and falls back, so a typo in a future caller is
  // visible rather than silently changing the document.
  function altTextLevelFrom(options) {
    const requested = options && options.altTextLevel;
    if (!requested) return DEFAULT_ALT_TEXT_LEVEL;
    const level = String(requested);
    if (KNOWN_ALT_TEXT_LEVELS.indexOf(level) === -1) {
      logWarn(
        "Unknown image-description level '" + level + "'; falling back to '" + DEFAULT_ALT_TEXT_LEVEL + "'"
      );
      return DEFAULT_ALT_TEXT_LEVEL;
    }
    return level;
  }

  // pageAltsFor(level, summary, pageCount, defaultAltFor) → the per-page alt
  // OVERRIDE array to hand the markup builder, or null when the level wants the
  // builder's own positional defaults on every page. PURE: defaultAltFor is passed
  // in rather than reached for through globalThis, so this runs and self-tests
  // under node with no markup module loaded, and the caller decides what supplies
  // the wording.
  //
  // Only level "summary" produces overrides, and only for page 1: the whole-piece
  // description belongs on the first page a reader meets, and repeating it on every
  // page is the failure mode buildMultiPageMarkup's own comment warns about. Later
  // pages get null, which the builder reads as "use the default".
  //
  // Returning null — not an array of nulls — for every other case is deliberate:
  // it means the level-1 and level-3 paths hand the builder exactly what they
  // handed it before this stage, so the document cannot differ by construction
  // rather than by a comparison somebody has to remember to run. An empty or
  // missing summary at level 2 takes the same route, since an alt of just "Score,
  // page 1 of N. " would be the default with a full stop bolted on.
  function pageAltsFor(level, summary, pageCount, defaultAltFor) {
    if (level !== ALT_TEXT_LEVELS.SUMMARY) return null;
    if (!pageCount || pageCount < 1) return null;

    const text = summary ? String(summary).trim() : "";
    if (!text) {
      logWarn("Image-description level 'summary' asked for, but the summary is empty; using page numbers only");
      return null;
    }

    const alts = [];
    for (let i = 0; i < pageCount; i++) {
      // Page 1 only. The positional prefix comes from defaultAltFor, so the two
      // modules cannot word the page identity differently.
      alts.push(i === 0 ? defaultAltFor(0, pageCount) + PAGE_ALT_JOIN + text : null);
    }
    return alts;
  }

  // meiMeasuresFrom(meiText) → [{ id, n }] for every <measure> in DOCUMENT ORDER,
  // each field null when the attribute is absent. PURE: a string in, an array out,
  // no toolkit and no DOM, so the join self-tests without Verovio.
  //
  // Read by REGEX rather than by DOMParser deliberately. The input is Verovio's
  // own machine-generated MEI, the two attributes wanted are on the opening tag,
  // and a DOMParser route would make this the file's second DOM touch and take the
  // join out of reach of a node-runnable row. The known limit is that an attribute
  // VALUE containing ">" would truncate a tag; xml:id and @n are generated ids and
  // source bar numbers, so it cannot arise here, and a truncated tag degrades to a
  // missing attribute, which the caller already treats as "cannot place this bar".
  function meiMeasuresFrom(meiText) {
    const rows = [];
    if (!meiText) return rows;
    // String.prototype.match resets a global regex's lastIndex itself, so the
    // shared MEI_MEASURE_TAG is safe to reuse across calls.
    const tags = String(meiText).match(MEI_MEASURE_TAG) || [];
    for (let i = 0; i < tags.length; i++) {
      const idMatch = tags[i].match(MEI_XML_ID_ATTR);
      const nMatch = tags[i].match(MEI_N_ATTR);
      rows.push({ id: idMatch ? idMatch[1] : null, n: nMatch ? nMatch[1] : null });
    }
    return rows;
  }

  // modelBarNumbers(model) → the bar-number string of every bar in part 0, in
  // order, null where the parser found none. PURE. Part 0 alone is correct here
  // and is not the merge the span module performs across parts: Verovio emits ONE
  // <measure> per BAR however many parts the score has (measured on Joplin — two
  // parts, 92 bars, 92 MEI measures), so the two sequences are the same length and
  // the same currency.
  function modelBarNumbers(model) {
    const measures =
      model && model.parts && model.parts[0] && Array.isArray(model.parts[0].measures)
        ? model.parts[0].measures
        : [];
    return measures.map(function (m) {
      return m && m.number !== undefined ? m.number : null;
    });
  }

  // pageBarIndexRanges(meiMeasures, modelNumbers, pageOf, pageCount) → an array of
  // length pageCount holding { fromIndex, toIndex } MODEL indices per page, or null
  // for a page whose range could not be established. PURE: pageOf is passed in, so
  // the whole join runs against a stubbed toolkit under node.
  //
  // THE JOIN IS NUMBER-TO-NUMBER, not position-to-position. The Stage 80 spike
  // established that MEI @n carries the source bar number verbatim and matches
  // MusicParse's measure.number element for element on all three real scores, so
  // the two sequences share a currency; joining by ORDINAL would look identical on
  // those scores and diverge silently on any score where they did not.
  //
  // THREE DEGRADATIONS, each chosen so a page is described correctly or not at all:
  //   - A bar whose id Verovio cannot place is SKIPPED. getPageWithElement returns
  //     numeric 0 for an unknown id — not null, and it does not throw — so the test
  //     is `typeof p === "number" && p >= 1`, never truthiness. Such a bar belongs
  //     to no page and so cannot make any page's range wrong.
  //   - A bar whose @n is absent, blank, unknown to the model, or carried by more
  //     than one model bar POISONS ITS PAGE, which then falls back to the
  //     positional default. Guessing which of two bars numbered "3" was meant is
  //     exactly the fabrication the span module refuses to do with bar numbers.
  //   - A page no bar reached at all stays null for the same reason.
  function pageBarIndexRanges(meiMeasures, modelNumbers, pageOf, pageCount) {
    const ranges = [];
    for (let i = 0; i < pageCount; i++) ranges.push(null);
    if (!Array.isArray(meiMeasures) || !Array.isArray(modelNumbers)) return ranges;
    if (typeof pageOf !== "function") return ranges;

    // Bar number → model index. A blank number contributes nothing; a repeat
    // overwrites the entry with the ambiguity sentinel, so the SECOND sighting
    // poisons the first rather than shadowing it.
    const indexOfNumber = new Map();
    for (let i = 0; i < modelNumbers.length; i++) {
      const key =
        modelNumbers[i] === null || modelNumbers[i] === undefined
          ? ""
          : String(modelNumbers[i]).trim();
      if (!key) continue;
      indexOfNumber.set(key, indexOfNumber.has(key) ? AMBIGUOUS_INDEX : i);
    }

    const spread = [];
    const poisoned = [];
    let unplaced = 0;
    for (let i = 0; i < meiMeasures.length; i++) {
      const row = meiMeasures[i] || {};
      const page = pageOf(row.id);
      if (typeof page !== "number" || page < 1 || page > pageCount) {
        unplaced++;
        continue;
      }
      const slot = page - 1;
      const key = row.n === null || row.n === undefined ? "" : String(row.n).trim();
      const idx = key ? indexOfNumber.get(key) : undefined;
      if (typeof idx !== "number" || idx < 0) {
        poisoned[slot] = true;
        continue;
      }
      const cur = spread[slot];
      if (!cur) spread[slot] = { min: idx, max: idx };
      else {
        if (idx < cur.min) cur.min = idx;
        if (idx > cur.max) cur.max = idx;
      }
    }

    if (unplaced > 0) {
      logWarn("Page-to-bars: " + unplaced + " bar(s) were not placed on any page and were skipped");
    }

    for (let i = 0; i < pageCount; i++) {
      if (poisoned[i] || !spread[i]) continue;
      ranges[i] = { fromIndex: spread[i].min, toIndex: spread[i].max };
    }
    return ranges;
  }

  // talkingScoreAltsFor(model, pageBarRanges, pageCount, defaultAltFor, summarise)
  // → the level-3 per-page alt OVERRIDE array, or null when NO page could be
  // described. PURE on the same terms as pageAltsFor: both the page-identity
  // wording and the description service are passed in, so this composes under node
  // with neither module loaded and neither wording is duplicated here.
  //
  // The alt is the positional prefix, then ". ", then the span summary — the same
  // shape as level 2, so a reader meets "where am I" before "what is here" at both
  // levels. Degradation is PER PAGE: a page with no range, or one the span service
  // declines to summarise, gets null and keeps the builder's positional default,
  // while its neighbours keep their descriptions. Returning null when nothing at
  // all could be described is what makes a total failure produce exactly today's
  // document rather than an array of nulls that happens to mean the same thing.
  function talkingScoreAltsFor(model, pageBarRanges, pageCount, defaultAltFor, summarise) {
    if (!pageCount || pageCount < 1) return null;
    if (!Array.isArray(pageBarRanges)) {
      logWarn("Image-description level 'talking-score' has no page-to-bars table; using page numbers only");
      return null;
    }

    const alts = [];
    let described = 0;
    for (let i = 0; i < pageCount; i++) {
      const range = pageBarRanges[i];
      const raw = range ? summarise(model, range.fromIndex, range.toIndex) : null;
      const text = raw ? String(raw).trim() : "";
      if (!text) {
        alts.push(null);
        continue;
      }
      alts.push(defaultAltFor(i, pageCount) + PAGE_ALT_JOIN + text);
      described++;
    }

    if (described === 0) {
      logWarn("Image-description level 'talking-score' described no pages; using page numbers only");
      return null;
    }
    if (described < pageCount) {
      logWarn(
        "Image-description level 'talking-score' described " +
          described +
          " of " +
          pageCount +
          " page(s); the rest keep page numbers only"
      );
    }
    return alts;
  }

  // Lazily-loaded, module-scoped cache of the typst.ts $typst handle. typst.ts is
  // a ~12MB ES module, so it is imported only on the first PDF request and then
  // reused. This dynamic import() is the SINGLE documented exception to the
  // project's no-ES-module rule; it lives behind getTypst so node --check stays
  // clean (the specifier is only resolved when the function is called).
  let typstPromise = null;
  function getTypst() {
    if (!typstPromise) {
      typstPromise = import(/* @vite-ignore */ TYPST_MODULE_URL).then(async function (mod) {
        // Point the compiler at the matched, pinned wasm. Done once per load.
        mod.$typst.setCompilerInitOptions({ getModule: () => TYPST_WASM_URL });
        // Register the font BEFORE resolving — see registerLeipzig on why the
        // ordering is load-bearing. It never throws, so this cannot reject.
        await registerLeipzig(mod);
        return mod.$typst;
      });
    }
    return typstPromise;
  }

  // registerLeipzig(mod) → Promise<void>. Hands the vendored Leipzig TTF to the typst
  // compiler so the SMuFL glyphs resolve in the PDF. Takes the whole module, not just
  // $typst, because the registration route needs the module's TypstSnippet export.
  //
  // THE ORDER IS LOAD-BEARING. $typst is a module-level singleton, so its compiler is
  // built on the FIRST getCompiler() and reused by every later call. A registration
  // that lands after that point silently does nothing, on every subsequent PDF, with
  // no error and no diagnostic to notice it by. Registering here — inside getTypst's
  // .then, before the cached promise resolves — is what guarantees it precedes the
  // getCompiler() in generate(), on the first call and on all of them.
  //
  // The route is the one the Arm E2 spike proved: preloadFontData is a static on the
  // TypstSnippet class, which the all-in-one-lite bundle does not export by name, so
  // it is reached through the instance's constructor when the named export is absent.
  // Two things measured and rejected: createTypstFontBuilder is declared in the type
  // definitions and is ABSENT from this bundle, and WOFF2 is ACCEPTED by the API but
  // parses zero faces while still reporting success — so only the TTF works, and a
  // WOFF2 would fail silently in the way this comment exists to prevent.
  //
  // A MISSING FONT IS NEVER FATAL, deliberately. typstPromise caches whatever this
  // settles to, a rejection included, so a throw here would poison every PDF attempt
  // for the life of the page and surface only the caller's generic "could not be
  // generated" message. Every failure — fetch not ok, network error, missing API
  // surface, a throw during registration — is logWarned once and swallowed, and the
  // promise resolves normally. The PDF then renders exactly as it did before the font
  // was vendored, with .notdef boxes in place of the SMuFL glyphs: a cosmetic loss on
  // the sighted layer, and nothing else about the document changes.
  async function registerLeipzig(mod) {
    let fontBytes;
    try {
      const res = await fetch(LEIPZIG_FONT_URL);
      if (!res.ok) throw new Error("HTTP " + res.status);
      fontBytes = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      logWarn(
        "Leipzig not fetched from " + LEIPZIG_FONT_URL + "; SMuFL glyphs will render as .notdef boxes",
        e
      );
      return;
    }

    try {
      const Cls = mod.TypstSnippet || (mod.$typst && mod.$typst.constructor);
      if (!Cls || typeof Cls.preloadFontData !== "function" || typeof mod.$typst.use !== "function") {
        throw new Error("preloadFontData or use absent from this typst.ts build");
      }
      mod.$typst.use(Cls.preloadFontData(fontBytes));
      logInfo("Leipzig registered with the typst compiler (" + fontBytes.length + " bytes)");
    } catch (e) {
      logWarn("Leipzig not registered with typst; SMuFL glyphs will render as .notdef boxes", e);
    }
  }

  // Wait for the Verovio wasm runtime, then resolve a fresh toolkit instance.
  // Lifted verbatim from the spike; reads globalThis.verovio at CALL time so the
  // Stage 17 <script> tag can provide it without this file referencing it at load.
  function verovioToolkitReady() {
    return new Promise(function (resolve, reject) {
      const v = globalThis.verovio;
      if (!v || !v.module) {
        reject(new Error("Verovio global not found"));
        return;
      }
      if (v.module.calledRun) {
        try {
          resolve(new v.toolkit());
        } catch (e) {
          reject(e);
        }
        return;
      }
      v.module.onRuntimeInitialized = function () {
        try {
          resolve(new v.toolkit());
        } catch (e) {
          reject(e);
        }
      };
    });
  }

  // renderPagesAndBars(xml, profile, model, engravingOverrides) →
  // Promise<{ svgs, pageBars }>. The
  // whole toolkit-owning body, and the ONLY place a toolkit instance exists ON
  // THE PDF PATH.
  //
  // CORRECTED AT STAGE 86, because the earlier wording ("the ONLY place a toolkit
  // instance exists") stated a rule wider than its own reason and would have
  // talked the next reader out of a safe design. The invariant is not "only one
  // toolkit may exist in the app": it is THE ID-TO-BAR MAP MUST COME FROM THE
  // INSTANCE THAT RENDERED, for the reason set out next. js/music-raster.js is a
  // DELIBERATE SECOND OWNER, minting its own function-local toolkit to engrave
  // bar-range excerpts. The invariant does not bind there because THE EXCERPT PATH
  // NEVER BUILDS THE MAP — it renders one page of a slice and reads no ids at all
  // — so it has nothing that could be attributed to the wrong instance. The two
  // also want different engraving options (that module's EXCERPT_ENGRAVING against
  // SHARED_ENGRAVING above), which must not be tidied into one.
  //
  // WHY THE BAR TABLE IS BUILT HERE AND NOT IN generate. The Stage 80 spike
  // measured that Verovio's xml:ids are RANDOM PER LOAD and that resetXmlIdSeed
  // does not make them stable — three loads of byte-identical input gave three
  // different id sets. So the id-to-bar map is only meaningful against the toolkit
  // instance that produced it, and can never be cached, persisted, or rebuilt on a
  // second load. `tk` is function-local and dies at return, so the table has to be
  // taken inside this body or not at all.
  //
  // model is optional and is the whole opt-in: null means "SVGs only", which is
  // what levels 1 and 2 ask for, so they pay nothing for a table they would not
  // read. The table is taken BEFORE any renderToSVG because the spike measured
  // that loadData alone settles the layout — probing before and after gave
  // identical results — so the join costs no SVG generation of its own.
  //
  // A failure to build the table is NEVER a failure to render. It is warned once
  // and leaves pageBars null, which the caller reads as "use the positional
  // defaults": a PDF with plainer alts beats no PDF at all.
  // engravingOverrides is optional and threads the Stage 90 seam through to the
  // ONE setOptions call on this path. Null means the profile's own merged options,
  // byte-identical to what this call passed before that stage.
  async function renderPagesAndBars(xml, profile, model, engravingOverrides) {
    const tk = await verovioToolkitReady();
    tk.setOptions(engravingOptionsFor(profile, engravingOverrides));
    const ok = tk.loadData(xml);
    if (ok === false) throw new Error("Verovio loadData reported failure");
    const pageCount = tk.getPageCount();
    if (!pageCount || pageCount < 1) {
      throw new Error("Verovio getPageCount returned " + pageCount);
    }

    let pageBars = null;
    if (model) {
      try {
        // getMEI() takes NO options on this build. Measured on the pinned
        // 6.2.0-43f8060: the bare call and getMEI({ pageNo: 0, scoreBased: true })
        // returned the IDENTICAL 105,519-character string on Satie, both carrying
        // all 47 <measure> elements, so the default already is the whole
        // unrendered score-based document.
        pageBars = pageBarIndexRanges(
          meiMeasuresFrom(tk.getMEI()),
          modelBarNumbers(model),
          function (id) {
            return tk.getPageWithElement(id);
          },
          pageCount
        );
      } catch (e) {
        logWarn("Page-to-bars table could not be built; page alts fall back to page numbers only", e);
        pageBars = null;
      }
    }

    const svgs = [];
    for (let n = 1; n <= pageCount; n++) {
      const svg = tk.renderToSVG(n); // n is 1-based
      if (!svg) throw new Error("Verovio renderToSVG(" + n + ") was empty");
      svgs.push(svg);
    }
    logInfo("renderPages produced " + svgs.length + " page SVG(s)");
    return { svgs: svgs, pageBars: pageBars };
  }

  // renderPages(xml, profile) → Promise<string[]> of one page SVG per page (its
  // length is the page count). The xml is already break-injected by the caller, so
  // breaks are honoured exactly. The page size and staff unit come from the named
  // engraving profile (standard or large-print) merged over the shared layout;
  // scale is dropped (retired — the width-fit cancels it).
  //
  // Kept as a thin wrapper over renderPagesAndBars so this exported contract —
  // two arguments in, an array of SVG strings out — is exactly what it was before
  // Stage 83. Passing no model means no MEI read and no probing, and passing no
  // engraving overrides keeps the exported contract two arguments after Stage 90:
  // the seam is reached through generate's options, never through this wrapper.
  async function renderPages(xml, profile) {
    const rendered = await renderPagesAndBars(xml, profile, null, null);
    return rendered.svgs;
  }

  // generate(model, xml, profile, options) → Promise<Uint8Array> of PDF bytes. The
  // orchestrator: it derives the bar count and title, reads the plain-language
  // summary, injects pagination breaks into a COPY of the xml, renders each page
  // under the named engraving profile, embeds each page as a vector SVG and the
  // ORIGINAL xml at absolute /assets paths, builds the markup via the Stage 15
  // builder, and compiles through the low-level typst.ts path. On a null/empty
  // result it logs the diagnostics and throws — never a silent null.
  //
  // options is optional. Its first key is altTextLevel, whose value is one of
  // ALT_TEXT_LEVELS. Absent options mean the default level, so every existing
  // three-argument call is unchanged. Since Stage 82 the level is READ rather than
  // dropped: at "summary" the whole-piece summary becomes page 1's figure alt, and
  // since Stage 83 "talking-score" gives every page an alt describing its own bars.
  //
  // STAGE 90 adds two more, both optional: `engraving`, merged over the profile's
  // Verovio options, and `pagination`, merged over the profile's bars-per-system.
  // Both are honoured at the large-print profile ONLY and refused with a warn
  // anywhere else, so the standard button is provably the document it was. Absent
  // overrides thread null and change nothing. NOTHING USER-VISIBLE READS THESE
  // YET — js/music-app.js still passes altTextLevel alone; the seam exists for the
  // Stage 91 controls to land on.
  async function generate(model, xml, profile, options) {
    const markupSvc = globalThis.MusicPdfMarkup;
    if (!markupSvc) throw new Error("MusicPdfMarkup is not available");
    const summarySvc = globalThis.MusicRenderSummary;
    const altTextLevel = altTextLevelFrom(options);
    const wantsPageBars = altTextLevel === ALT_TEXT_LEVELS.TALKING_SCORE;
    // Resolved ONCE here, so the large-print-only refusal happens in one place and
    // both consumers below are handed the same decision rather than each re-reading
    // options and each having to remember the rule.
    const overrides = profileOverridesFrom(options, profile);

    const barCount =
      model && model.parts[0] && model.parts[0].measures
        ? model.parts[0].measures.length
        : 0;
    const title = model && model.workTitle ? model.workTitle : DEFAULT_TITLE;
    const lang = DOC_LANG;

    // Summary text, read from the ORIGINAL model. Since Stage 82 the summary
    // module hands the prose back as a string, so the preferred route touches no
    // DOM at all. The detached-<div> route below is the fallback for a page whose
    // summary module predates that method: it is the orchestrator's only DOM
    // touch, and it now only ever runs in that degraded case.
    let summaryText = "";
    if (summarySvc && typeof summarySvc.summaryText === "function") {
      summaryText = summarySvc.summaryText(model) || "";
    } else if (summarySvc) {
      logWarn("MusicRenderSummary has no summaryText(); falling back to reading a rendered paragraph");
      const div = document.createElement("div");
      summarySvc.render(model, div);
      const p = div.querySelector("p");
      summaryText = p ? p.textContent : "";
    }

    // Inject breaks into a COPY; the original xml stays the attachment and the
    // source of the summary's data.
    const brokenXml = markupSvc.withEncodedBreaks(xml, barCount, profile, overrides.pagination);
    // The model is threaded in ONLY at level 3, and that is what asks for the
    // page-to-bars table. It has to be built inside this call, against the same
    // toolkit instance that renders the pages — see renderPagesAndBars on the
    // random-id trap that makes any other arrangement unsound.
    const rendered = await renderPagesAndBars(
      brokenXml,
      profile,
      wantsPageBars ? model : null,
      overrides.engraving
    );
    const svgs = rendered.svgs;

    const $typst = await getTypst();
    const compiler = await $typst.getCompiler();

    // Map each page as a vector SVG at an absolute .svg /assets path, then the
    // original xml. The builder emits the path verbatim, so #image auto-detects
    // SVG from the .svg extension; no markup change is needed.
    const pageImagePaths = [];
    for (let i = 0; i < svgs.length; i++) {
      const path = "/assets/page-" + (i + 1) + ".svg";
      compiler.mapShadow(path, new TextEncoder().encode(svgs[i]));
      pageImagePaths.push(path);
    }
    compiler.mapShadow(ATTACH_PATH, new TextEncoder().encode(xml));

    const attachments = [
      {
        path: ATTACH_PATH,
        mimeType: MUSICXML_MIME,
        description: "MusicXML source of " + title + ".",
        relationship: "source",
      },
    ];

    // The per-page alt overrides for the chosen level. Null at level 1, so the
    // builder produces exactly the document it produced before Stage 82. The
    // page-identity prefix comes from the builder's own pageAltFor at BOTH
    // overriding levels, so that wording lives in one module.
    //
    // The level-3 branch is wrapped whole. Every piece inside it already degrades
    // on its own — pageBars is null on a failed table, spanSummary never throws
    // and returns null on bad input, and the composer returns null when no page
    // could be described — so this catch is a BACKSTOP for a future helper, on the
    // same terms as spanSummary's own. A page description is never worth failing a
    // PDF for: the fallback is the document level 1 would have produced.
    let pageAlts = null;
    if (wantsPageBars) {
      try {
        const spanSvc = describeSpanSvc();
        pageAlts = talkingScoreAltsFor(
          model,
          rendered.pageBars,
          pageImagePaths.length,
          markupSvc.pageAltFor,
          function (m, fromIndex, toIndex) {
            return spanSvc.spanSummary(m, fromIndex, toIndex);
          }
        );
      } catch (e) {
        logWarn("Talking-score page alts could not be composed; using page numbers only", e);
        pageAlts = null;
      }
    } else {
      pageAlts = pageAltsFor(altTextLevel, summaryText, pageImagePaths.length, markupSvc.pageAltFor);
    }
    logDebug("PDF image-description level applied", {
      level: altTextLevel,
      overrides: pageAlts ? pageAlts.length : 0,
    });

    // Stage 84: the note-list appendix, at the talking-score level ONLY. Levels 1
    // and 2 pass no outline and therefore emit the byte-identical document they
    // emitted before this stage, which is what keeps their comparison baselines
    // usable. Wrapped whole on the same terms as the level-3 alts above: outlineOf
    // does not throw and returns null on a bad model, so this catch is a BACKSTOP,
    // and an appendix is never worth failing a PDF for.
    let outline = null;
    if (wantsPageBars) {
      try {
        outline = renderTextSvc().outlineOf(model);
      } catch (e) {
        logWarn("Talking-score appendix could not be built; the PDF will carry no note list", e);
        outline = null;
      }
    }
    logDebug("PDF talking-score appendix", {
      level: altTextLevel,
      blocks: outline && Array.isArray(outline.blocks) ? outline.blocks.length : 0,
    });

    const markup = markupSvc.buildMultiPageMarkup({
      title: title,
      lang: lang,
      summaryText: summaryText,
      pageImagePaths: pageImagePaths,
      attachments: attachments,
      pageAlts: pageAlts,
      outline: outline,
    });

    // Write the markup as the main .typ source and compile via the low-level path.
    compiler.addSource(MAIN, markup);
    const res = await compiler.compile({
      root: "/",
      mainFilePath: MAIN,
      format: FORMAT_PDF,
      diagnostics: "full",
    });
    const diagnostics = res && res.diagnostics;
    const result = res && res.result;
    if (!(result instanceof Uint8Array) || result.length === 0) {
      logError("Typst compile produced no PDF", diagnostics);
      throw new Error("Typst compile produced no PDF bytes; see diagnostics");
    }
    logInfo("generate produced PDF (" + result.length + " bytes, " + pageImagePaths.length + " page(s))");
    return result;
  }

  // selfTest — checks the orchestrator's own surface. Nothing here touches a
  // canvas, so it stays synchronous. Builds a results object, console.table()s
  // it and returns it.
  function selfTest() {
    const markupSvc = globalThis.MusicPdfMarkup || null;

    // The pure engraving-options builder is node-safe (no toolkit, no DOM), so it
    // is exercised directly here. The Verovio and typst runtime path stays
    // browser-proven by hand and out of selfTest.
    const standardOpts = engravingOptionsFor("standard");
    const largePrintOpts = engravingOptionsFor("large-print");

    // ---- Stage 90 (the engraving override seam) ----
    //
    // The named base blocks are snapshotted HERE, before any override call, so the
    // no-mutation row below reads a genuine before-and-after rather than comparing
    // a block against itself. The two calls above cannot have written them (each
    // merges onto a fresh {}), but a snapshot taken after the thing under test is
    // no snapshot at all, so it is taken first regardless.
    const SHARED_BEFORE = JSON.stringify(SHARED_ENGRAVING);
    const LP_ENTRY_BEFORE = JSON.stringify(ENGRAVING_PROFILES["large-print"]);

    // The allowed set for large-print, rebuilt here exactly as the function builds
    // it, so the unknown-key rows below name what the WARN names. The logWarn call
    // itself is not observable from inside selfTest — this IIFE destructured its
    // logger at load, so a stub installed now would not be the one the function
    // holds — and it is proved by execution instead, by loading this module into a
    // VM context with a recording MusicLog seeded ahead of it. That run is in the
    // Stage 90 record in music-poc/docs/backlog-clearance-plan.md.
    const LP_ALLOWED = Object.keys(SHARED_ENGRAVING)
      .concat(Object.keys(ENGRAVING_PROFILES["large-print"]))
      .concat(KNOWN_EXTRA_ENGRAVING_KEYS);
    const overrideKnown = engravingOptionsFor("large-print", { unit: 14 });
    const overrideExtra = engravingOptionsFor("large-print", { scale: 55 });
    const overrideUnknown = engravingOptionsFor("large-print", { bogusOption: 99 });
    const overrideMixed = engravingOptionsFor("large-print", { unit: 14, bogusOption: 99 });
    const SHARED_AFTER = JSON.stringify(SHARED_ENGRAVING);
    const LP_ENTRY_AFTER = JSON.stringify(ENGRAVING_PROFILES["large-print"]);

    // Stage 82: the image-description level. Both helpers are pure, so they are
    // driven directly here — no Verovio, no typst, no compile. A LOCAL stub stands
    // in for the markup module's pageAltFor, so the rows below run under node with
    // nothing else loaded; a separate row then proves the REAL builder's wording is
    // what generate actually threads through.
    function stubDefaultAlt(index, pageCount) {
      return "PAGE " + (index + 1) + "/" + pageCount;
    }
    const SUMMARY_PROSE = "This piece has 1 part across 2 bars.";
    const summaryAlts = pageAltsFor("summary", SUMMARY_PROSE, 3, stubDefaultAlt);
    // Held in a variable and array-guarded at the point of use below. Reading
    // [0] inline off the call would THROW when pageAltsFor returns null, and a
    // selfTest that throws reports nothing at all rather than reddening the one
    // row that is wrong — which is exactly what an inversion of pageAltsFor
    // produced before this guard was added.
    const realPrefixAlts =
      markupSvc && typeof markupSvc.pageAltFor === "function"
        ? pageAltsFor("summary", SUMMARY_PROSE, 2, markupSvc.pageAltFor)
        : null;

    // Stage 83: the page-to-bars join. Driven against a STUBBED TOOLKIT — an
    // object with getMEI and getPageWithElement and nothing else — so every row
    // below runs synchronously with no Verovio, no wasm and no compile. The stub's
    // getPageWithElement returns numeric 0 for an id it does not know, which is
    // what the real toolkit was MEASURED to do (both a bogus id and an empty
    // string returned 0, not null, and neither threw), so the 0-sentinel is
    // exercised by the fixture rather than asserted about in prose.
    function stubMei(specs) {
      const parts = specs.map(function (s) {
        const tail = s.tail || "";
        const n = s.n === null ? "" : ' n="' + s.n + '"';
        return '<measure xml:id="' + s.id + '"' + tail + n + "/>";
      });
      // The <measureRest> is a NEGATIVE fixture: its name starts with "measure",
      // so a \b-anchored pattern would count it as a bar. It must never appear in
      // a parsed row.
      parts.push('<measureRest xml:id="not-a-measure" n="99"/>');
      return "<section>" + parts.join("") + "</section>";
    }
    function stubToolkit(mei, pageMap) {
      return {
        getMEI() {
          return mei;
        },
        getPageWithElement(id) {
          const p = pageMap[id];
          return typeof p === "number" ? p : 0;
        },
      };
    }
    function joinWith(tk, numbers, pageCount) {
      return pageBarIndexRanges(
        meiMeasuresFrom(tk.getMEI()),
        numbers,
        function (id) {
          return tk.getPageWithElement(id);
        },
        pageCount
      );
    }

    // Bar 3 carries right="end" BETWEEN xml:id and n, which is the exact shape the
    // real Satie emits on its last bar; it is here so the two attributes cannot be
    // read as an adjacent pair.
    const MEI_CLEAN = stubMei([
      { id: "m-a", n: "1" },
      { id: "m-b", n: "2" },
      { id: "m-c", n: "3", tail: ' right="end"' },
      { id: "m-d", n: "4" },
    ]);
    const NUMBERS_CLEAN = ["1", "2", "3", "4"];
    const PAGES_CLEAN = { "m-a": 1, "m-b": 1, "m-c": 2, "m-d": 2 };
    const cleanRows = meiMeasuresFrom(MEI_CLEAN);
    const joinClean = joinWith(stubToolkit(MEI_CLEAN, PAGES_CLEAN), NUMBERS_CLEAN, 2);
    // m-c is absent from the map, so the stub answers 0 for it: an unplaced bar,
    // skipped, leaving page 2 holding m-d alone.
    const joinZero = joinWith(
      stubToolkit(MEI_CLEAN, { "m-a": 1, "m-b": 1, "m-d": 2 }),
      NUMBERS_CLEAN,
      2
    );
    const joinAllZero = joinWith(stubToolkit(MEI_CLEAN, {}), NUMBERS_CLEAN, 2);
    const MEI_NULL_N = stubMei([
      { id: "m-a", n: "1" },
      { id: "m-b", n: "2" },
      { id: "m-c", n: "3" },
      { id: "m-d", n: null },
    ]);
    const joinNullN = joinWith(stubToolkit(MEI_NULL_N, PAGES_CLEAN), NUMBERS_CLEAN, 2);
    const MEI_DUP = stubMei([
      { id: "m-a", n: "1" },
      { id: "m-b", n: "2" },
      { id: "m-c", n: "3" },
      { id: "m-d", n: "3" },
    ]);
    const joinDup = joinWith(stubToolkit(MEI_DUP, PAGES_CLEAN), ["1", "2", "3", "3"], 2);
    const MEI_UNKNOWN_N = stubMei([
      { id: "m-a", n: "1" },
      { id: "m-b", n: "2" },
      { id: "m-c", n: "3" },
      { id: "m-d", n: "9" },
    ]);
    const joinUnknown = joinWith(stubToolkit(MEI_UNKNOWN_N, PAGES_CLEAN), NUMBERS_CLEAN, 2);
    const joinEmptyPage = joinWith(stubToolkit(MEI_CLEAN, PAGES_CLEAN), NUMBERS_CLEAN, 3);

    // The level-3 composer, driven with a stub description service so no model and
    // no MusicDescribeSpan are needed. The stub names its own bar indices, so a
    // row can tell WHICH range reached it rather than only that something did.
    function stubSummarise(model, fromIndex, toIndex) {
      return "Bars " + (fromIndex + 1) + " to " + (toIndex + 1) + ".";
    }
    const RANGES_TWO = [
      { fromIndex: 0, toIndex: 1 },
      { fromIndex: 2, toIndex: 3 },
    ];
    const talkingAlts = talkingScoreAltsFor(null, RANGES_TWO, 2, stubDefaultAlt, stubSummarise);
    const talkingHalf = talkingScoreAltsFor(
      null,
      [{ fromIndex: 0, toIndex: 1 }, null],
      2,
      stubDefaultAlt,
      stubSummarise
    );
    const talkingNullSpan = talkingScoreAltsFor(null, RANGES_TWO, 2, stubDefaultAlt, function (m, a) {
      return a === 0 ? "Bars 1 to 2." : null;
    });
    const talkingBlankSpan = talkingScoreAltsFor(null, RANGES_TWO, 2, stubDefaultAlt, function (m, a) {
      return a === 0 ? "Bars 1 to 2." : "   ";
    });
    const talkingRealPrefix =
      markupSvc && typeof markupSvc.pageAltFor === "function"
        ? talkingScoreAltsFor(null, RANGES_TWO, 2, markupSvc.pageAltFor, stubSummarise)
        : null;

    const results = {
      hasRenderPages: typeof renderPages === "function",
      hasGenerate: typeof generate === "function",
      hasSelfTest: typeof selfTest === "function",
      pdfMagicTrueOnPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x25, 0x50, 0x44, 0x46, 0x2d]) === true,
      pdfMagicFalseOnNonPdf:
        !!markupSvc && markupSvc.pdfMagicOk([0x00, 0x01, 0x02, 0x03]) === false,
      standardPageSize:
        standardOpts.pageWidth === 2100 &&
        standardOpts.pageHeight === 2970 &&
        standardOpts.unit === 9,
      standardHasNoScale: !("scale" in standardOpts),
      standardOmitsLineWidths: !("staffLineWidth" in standardOpts),
      absentMatchesStandard:
        JSON.stringify(engravingOptionsFor()) === JSON.stringify(standardOpts),
      largePrintPageSize:
        largePrintOpts.pageWidth === 1200 &&
        largePrintOpts.pageHeight === 1700 &&
        largePrintOpts.unit === 12,
      // RE-POINTED AT STAGE 89, because the row's name claimed more than it
      // proved. It was `largePrintLineWidths`, and beside a profile comment
      // about "slightly heavier lines" it read as proof that heavier lines were
      // being applied. They are not: these three values ARE Verovio 6.2.0's
      // defaults (read off a bare toolkit), so the profile sets each option to
      // the value it would have had anyway and the render is byte-identical
      // without them. The row still pins the same three numbers — that is worth
      // pinning, because they are the seam the Stage C thickness choice will
      // land on and a silent drift would move it — but it now says that the
      // profile carries the DEFAULT-EQUAL values deliberately. Whether they are
      // still equal to the defaults is a claim about VEROVIO, not about this
      // file, so it is not assertable here without a toolkit; it was measured at
      // Stage 89 and is recorded in the profile comment above.
      largePrintLineWidthsAreVerovioDefaultsDeliberately:
        largePrintOpts.staffLineWidth === 0.15 &&
        largePrintOpts.barLineWidth === 0.3 &&
        largePrintOpts.stemWidth === 0.2,
      unknownFallsBackToStandard:
        JSON.stringify(engravingOptionsFor("bogus")) === JSON.stringify(standardOpts),
      sharedOptionsPresent:
        standardOpts.breaks === "line" && standardOpts.adjustPageHeight === false,

      // ---- Stage 90 (the engraving override seam) ----
      hasEngravingOverrideSeam: engravingOptionsFor.length === 2,
      hasProfileOverridesFrom: typeof profileOverridesFrom === "function",

      // ABSENT AND EMPTY OVERRIDES ARE BYTE-IDENTICAL TO TODAY. Compared as JSON
      // strings, which pins the key ORDER as well as the values — a merge that
      // produced the right values in a different order would still be a changed
      // options object, and Verovio is handed the object rather than a set of
      // values. The undefined and {} routes are separate rows because they take
      // different branches: undefined short-circuits acceptedOverrides, {} runs
      // its loop zero times.
      overrideAbsentIsIdenticalToToday:
        JSON.stringify(engravingOptionsFor("large-print", undefined)) ===
        JSON.stringify(largePrintOpts),
      overrideEmptyIsIdenticalToToday:
        JSON.stringify(engravingOptionsFor("large-print", {})) ===
        JSON.stringify(largePrintOpts),
      overrideNullIsIdenticalToToday:
        JSON.stringify(engravingOptionsFor("large-print", null)) ===
        JSON.stringify(largePrintOpts),

      // A KNOWN KEY IS APPLIED — and applied as the LAST merge term, so it beats
      // the profile entry's own value rather than being beaten by it. The profile
      // sets unit 12; the override must win.
      overrideKnownKeyApplied: overrideKnown.unit === 14,
      overrideKnownKeyBeatsProfileEntry:
        ENGRAVING_PROFILES["large-print"].unit === 12 && overrideKnown.unit === 14,
      // Everything the override did not name is untouched, so an override is a
      // re-point and never a replacement.
      overrideKnownKeyLeavesTheRestAlone:
        overrideKnown.pageWidth === largePrintOpts.pageWidth &&
        overrideKnown.breaks === largePrintOpts.breaks &&
        Object.keys(overrideKnown).length === Object.keys(largePrintOpts).length,

      // THE EXTRA-NAME CLAUSE IS LIVE, not decorative: `scale` is in no block, so
      // it can only be accepted through KNOWN_EXTRA_ENGRAVING_KEYS. The row asserts
      // its own precondition — that scale is ABSENT without an override — in the
      // same expression, so it cannot pass by the key having been there all along.
      overrideExtraVerovioKeyApplied:
        !("scale" in largePrintOpts) && overrideExtra.scale === 55,

      // AN UNKNOWN KEY IS DROPPED, and is named in the list the warn is built
      // from. Three rows, because "dropped" and "named" are different claims and a
      // mixed object proves the drop is per-key rather than per-call.
      overrideUnknownKeyNamedForWarn:
        unknownOverrideKeys({ bogusOption: 99 }, LP_ALLOWED).join(",") === "bogusOption",
      overrideKnownKeyNotNamedForWarn:
        unknownOverrideKeys({ unit: 14 }, LP_ALLOWED).length === 0,
      overrideUnknownKeyDropped:
        !("bogusOption" in overrideUnknown) &&
        JSON.stringify(overrideUnknown) === JSON.stringify(largePrintOpts),
      overrideMixedKeepsKnownDropsUnknown:
        overrideMixed.unit === 14 && !("bogusOption" in overrideMixed),

      // THE BASE BLOCKS ARE NEVER WRITTEN. Read before the override calls above
      // and again after them, and compared; the large-print entry's unit is also
      // asserted at its literal value, so a snapshot that had somehow captured a
      // mutated block could not pass.
      overrideLeavesSharedBlockUnmutated: SHARED_BEFORE === SHARED_AFTER,
      overrideLeavesProfileEntryUnmutated:
        LP_ENTRY_BEFORE === LP_ENTRY_AFTER &&
        ENGRAVING_PROFILES["large-print"].unit === 12,

      // OVERRIDES ARE REFUSED ANYWHERE BUT LARGE-PRINT, which is what makes "the
      // standard button is unchanged" a property of this function rather than of
      // nobody having wired a control to it. Both halves are asserted: refused on
      // standard and on an absent profile, honoured on large-print.
      overrideRefusedOnStandardProfile: (function () {
        const r = profileOverridesFrom({ engraving: { unit: 14 }, pagination: { barsPerSystem: 5 } }, "standard");
        return r.engraving === null && r.pagination === null;
      })(),
      overrideRefusedOnAbsentProfile: (function () {
        const r = profileOverridesFrom({ engraving: { unit: 14 } }, undefined);
        return r.engraving === null;
      })(),
      overrideHonouredOnLargePrint: (function () {
        const r = profileOverridesFrom(
          { engraving: { unit: 14 }, pagination: { barsPerSystem: 3 } },
          "large-print"
        );
        return r.engraving.unit === 14 && r.pagination.barsPerSystem === 3;
      })(),
      // Absent options and an options object carrying only altTextLevel — the
      // shape js/music-app.js actually passes — both give the null pair, so every
      // existing call threads exactly what it threaded before this stage.
      overrideAbsentOptionsGiveNullPair: (function () {
        const r = profileOverridesFrom(undefined, "large-print");
        return r.engraving === null && r.pagination === null;
      })(),
      overrideLevelOnlyOptionsGiveNullPair: (function () {
        const r = profileOverridesFrom({ altTextLevel: "summary" }, "large-print");
        return r.engraving === null && r.pagination === null;
      })(),

      // Stage 70 (M1-14): the Leipzig font. These rows stay PURE — they assert the
      // shared option and the URL's shape, never the fetch or the registration, so
      // selfTest stays synchronous and node-runnable and the typst path stays out of
      // it. That the font actually reaches the compiler is browser-proven by hand.
      sharedSetsSmuflTextFontLinked: SHARED_ENGRAVING.smuflTextFont === "linked",
      standardCarriesSmuflOption: standardOpts.smuflTextFont === "linked",
      largePrintCarriesSmuflOption: largePrintOpts.smuflTextFont === "linked",
      // Document-relative: no leading slash, no scheme. Either would resolve wrongly
      // once the page is served from the repo root as /music-poc/index.html.
      fontUrlIsDocumentRelative:
        LEIPZIG_FONT_URL.charAt(0) !== "/" && !/^[a-z][a-z0-9+.-]*:/i.test(LEIPZIG_FONT_URL),

      // Stage 82 (M1-16): the image-description level is READ, not dropped. The
      // Stage 81 record pinned generate.length === 3 as the proof it was dropped;
      // this is the same measurement, moved.
      hasAltTextLevelFrom: typeof altTextLevelFrom === "function",
      hasPageAltsFor: typeof pageAltsFor === "function",
      generateTakesOptions: generate.length === 4,
      // The enum's values must equal the radio values in index.html; a row here is
      // the only place the two documents are compared.
      levelValuesMatchRadioValues:
        KNOWN_ALT_TEXT_LEVELS.join(",") === "pages,summary,talking-score",

      // Level resolution. Absent, empty and unknown all land on the default, by
      // three different routes through the function.
      absentOptionsIsDefaultLevel: altTextLevelFrom(undefined) === "pages",
      emptyLevelIsDefaultLevel: altTextLevelFrom({ altTextLevel: "" }) === "pages",
      unknownLevelFallsBackToPages: altTextLevelFrom({ altTextLevel: "bogus" }) === "pages",
      summaryLevelResolves: altTextLevelFrom({ altTextLevel: "summary" }) === "summary",
      talkingScoreLevelResolves:
        altTextLevelFrom({ altTextLevel: "talking-score" }) === "talking-score",

      // Level 1 hands the builder NO overrides, which is what makes its output
      // identical to the pre-Stage-82 document by construction rather than by a
      // comparison.
      pagesLevelProducesNoOverrides:
        pageAltsFor("pages", SUMMARY_PROSE, 3, stubDefaultAlt) === null,
      // MEANING CHANGED AT STAGE 83, and the row is kept rather than renamed so
      // the measurement stays traceable. It no longer says "talking-score ships
      // the defaults" — it says pageAltsFor is the LEVEL-2 builder and never
      // speaks for level 3, which now has its own composer. The companion row
      // talkingScoreOverridesComeFromSpanBuilder is the other half: without it,
      // this row alone would still pass if level 3 had been dropped entirely.
      talkingScoreLevelProducesNoOverrides:
        pageAltsFor("talking-score", SUMMARY_PROSE, 3, stubDefaultAlt) === null,
      talkingScoreOverridesComeFromSpanBuilder:
        Array.isArray(talkingAlts) && talkingAlts.length === 2,

      // Level 2: page 1 carries the prefix then the summary; every later page is
      // null, which the builder reads as "use the positional default". The row
      // asserts the WHOLE page-1 string, so a changed separator fails it.
      summaryLevelOverridesPage1Only:
        Array.isArray(summaryAlts) &&
        summaryAlts.length === 3 &&
        summaryAlts[0] === "PAGE 1/3. " + SUMMARY_PROSE &&
        summaryAlts[1] === null &&
        summaryAlts[2] === null,
      // The page identity survives IN FRONT of the description: the alt starts
      // with the positional prefix, it does not merely contain it.
      summaryAltKeepsPageIdentityFirst:
        Array.isArray(summaryAlts) && summaryAlts[0].indexOf(stubDefaultAlt(0, 3)) === 0,
      // The prefix comes from the SUPPLIED default builder, not from a private copy
      // of the wording — the stub's output is nothing like the real one, so a
      // hard-coded "Score, page" in pageAltsFor would fail this row.
      summaryAltPrefixComesFromCaller:
        Array.isArray(summaryAlts) && summaryAlts[0].indexOf("Score, page") === -1,
      // …and generate threads the REAL builder's wording, so the two modules agree.
      // Guarded on markupSvc so the row degrades rather than throwing under node
      // with the builder absent.
      summaryAltPrefixMatchesBuilderWording:
        Array.isArray(realPrefixAlts) &&
        realPrefixAlts[0] === "Score, page 1 of 2. " + SUMMARY_PROSE,

      // Degradation: an empty or missing summary at level 2 falls back to the
      // positional defaults rather than shipping "Score, page 1 of 3. " alone.
      summaryLevelEmptyProseFallsBack:
        pageAltsFor("summary", "", 3, stubDefaultAlt) === null &&
        pageAltsFor("summary", null, 3, stubDefaultAlt) === null &&
        pageAltsFor("summary", "   ", 3, stubDefaultAlt) === null,
      summaryLevelZeroPagesFallsBack:
        pageAltsFor("summary", SUMMARY_PROSE, 0, stubDefaultAlt) === null,

      // ---- Stage 83 (M1-17): per-page alts at the talking-score level ----

      // Surface. renderPages keeps its two-argument contract: the bar table is
      // built by renderPagesAndBars, which it now wraps, so no existing caller
      // sees a changed signature or a changed return type.
      hasRenderPagesAndBars: typeof renderPagesAndBars === "function",
      renderPagesKeepsTwoArgContract: renderPages.length === 2,
      hasMeiMeasuresFrom: typeof meiMeasuresFrom === "function",
      hasModelBarNumbers: typeof modelBarNumbers === "function",
      hasPageBarIndexRanges: typeof pageBarIndexRanges === "function",
      hasTalkingScoreAltsFor: typeof talkingScoreAltsFor === "function",

      // The consumer-side stub for MusicDescribeSpan. Every method this module
      // calls on that service must be declared, and the declared value must be the
      // one the composer already reads as "no description for this page".
      spanStubDeclaresSpanSummary:
        typeof SPAN_STUB.spanSummary === "function" && SPAN_STUB.spanSummary(null, 0, 1) === null,
      // Resolution is at CALL time, so the row asserts whichever answer this page
      // makes true rather than assuming the module loaded.
      describeSpanSvcResolvesAtCallTime: globalThis.MusicDescribeSpan
        ? describeSpanSvc() === globalThis.MusicDescribeSpan
        : describeSpanSvc() === SPAN_STUB,

      // MEI reading. The <measureRest> in every fixture is the negative control:
      // a pattern anchored on \b instead of the lookahead would count it as a bar
      // and every range in the file would silently gain one.
      meiFindsEveryMeasure: cleanRows.length === 4,
      meiIgnoresMeasureRest:
        cleanRows.filter(function (r) {
          return r.id === "not-a-measure";
        }).length === 0,
      meiReadsIdAndNumber: cleanRows[0].id === "m-a" && cleanRows[0].n === "1",
      // The measured trap: bar 3's right="end" sits BETWEEN the two attributes.
      meiReadsAttributesInAnyOrder: cleanRows[2].id === "m-c" && cleanRows[2].n === "3",
      meiNullNumberWhenAttributeAbsent: meiMeasuresFrom(MEI_NULL_N)[3].n === null,
      meiEmptyInputIsEmptyArray:
        meiMeasuresFrom("").length === 0 && meiMeasuresFrom(null).length === 0,

      // Model bar numbers, VERBATIM from part 0 — no arithmetic, no normalisation,
      // so a non-numeric or absent number survives to the join as itself.
      modelBarNumbersReadsVerbatim:
        JSON.stringify(
          modelBarNumbers({ parts: [{ measures: [{ number: "1" }, { number: "1a" }, { number: null }] }] })
        ) === JSON.stringify(["1", "1a", null]),
      modelBarNumbersEmptyOnBadModel:
        modelBarNumbers(null).length === 0 && modelBarNumbers({ parts: [] }).length === 0,

      // The join itself, on the stubbed toolkit. The clean case is the shape the
      // three real scores produce: contiguous model indices, one range per page.
      joinBuildsOneRangePerPage:
        Array.isArray(joinClean) &&
        joinClean.length === 2 &&
        joinClean[0].fromIndex === 0 &&
        joinClean[0].toIndex === 1 &&
        joinClean[1].fromIndex === 2 &&
        joinClean[1].toIndex === 3,
      // Page 2 starts at index 2 only because m-c's n was read past its right="end".
      joinReadsNumberPastIntervalAttribute: joinClean[1].fromIndex === 2,

      // The 0-sentinel. An unknown id answers numeric 0, which is falsy but is NOT
      // null and does NOT throw, so it must be rejected by a >= 1 test rather than
      // by truthiness — and it must never be read as "page 0" and land in a slot.
      joinTreatsZeroAsUnplaced:
        Array.isArray(joinZero) &&
        joinZero.length === 2 &&
        joinZero[0].fromIndex === 0 &&
        joinZero[0].toIndex === 1 &&
        joinZero[1].fromIndex === 3 &&
        joinZero[1].toIndex === 3,
      joinAllUnplacedGivesNoRanges:
        Array.isArray(joinAllZero) &&
        joinAllZero.length === 2 &&
        joinAllZero[0] === null &&
        joinAllZero[1] === null,

      // Degradation, PER PAGE. Each of the three unjoinable-number cases takes out
      // exactly the page carrying the bad bar; the other page keeps its range, so
      // a row can tell "degraded" from "gave up".
      joinNullNumberFallsBackForThatPageOnly:
        Array.isArray(joinNullN) && joinNullN[0] !== null && joinNullN[0].fromIndex === 0 && joinNullN[1] === null,
      joinDuplicateNumberFallsBackForThatPageOnly:
        Array.isArray(joinDup) && joinDup[0] !== null && joinDup[0].fromIndex === 0 && joinDup[1] === null,
      joinUnknownNumberFallsBackForThatPageOnly:
        Array.isArray(joinUnknown) &&
        joinUnknown[0] !== null &&
        joinUnknown[0].fromIndex === 0 &&
        joinUnknown[1] === null,
      joinPageWithNoBarsIsNull:
        Array.isArray(joinEmptyPage) && joinEmptyPage.length === 3 && joinEmptyPage[2] === null,
      joinBadInputGivesAllNulls:
        JSON.stringify(pageBarIndexRanges(null, NUMBERS_CLEAN, function () { return 1; }, 2)) ===
          JSON.stringify([null, null]) &&
        JSON.stringify(pageBarIndexRanges(cleanRows, NUMBERS_CLEAN, null, 2)) ===
          JSON.stringify([null, null]),

      // Composition. The alt is the positional prefix, then ". ", then the span
      // prose — asserted as WHOLE strings, so a changed separator fails the row.
      talkingScoreComposesPrefixThenSpan:
        Array.isArray(talkingAlts) &&
        talkingAlts[0] === "PAGE 1/2. Bars 1 to 2." &&
        talkingAlts[1] === "PAGE 2/2. Bars 3 to 4.",
      // Each page describes ITS OWN bars: page 2's alt names 3 to 4, which is only
      // reachable if that page's own range reached the description service.
      talkingScorePagesDescribeTheirOwnBars:
        Array.isArray(talkingAlts) && talkingAlts[1].indexOf("Bars 3 to 4.") !== -1,
      talkingScoreKeepsPageIdentityFirst:
        Array.isArray(talkingAlts) && talkingAlts[0].indexOf(stubDefaultAlt(0, 2)) === 0,
      // The prefix comes from the SUPPLIED builder, not a private copy: the stub's
      // wording is nothing like the real one, so a hard-coded "Score, page" fails.
      talkingScorePrefixComesFromCaller:
        Array.isArray(talkingAlts) && talkingAlts[0].indexOf("Score, page") === -1,
      talkingScorePrefixMatchesBuilderWording:
        Array.isArray(talkingRealPrefix) &&
        talkingRealPrefix[0] === "Score, page 1 of 2. Bars 1 to 2." &&
        talkingRealPrefix[1] === "Score, page 2 of 2. Bars 3 to 4.",

      // Per-page fallback: an undescribable page is null — the builder's "use the
      // default" — while its neighbour keeps its description. Three routes in.
      talkingScoreNullRangeFallsBackForThatPageOnly:
        Array.isArray(talkingHalf) && talkingHalf[0] === "PAGE 1/2. Bars 1 to 2." && talkingHalf[1] === null,
      talkingScoreNullSummaryFallsBackForThatPageOnly:
        Array.isArray(talkingNullSpan) && talkingNullSpan[0] !== null && talkingNullSpan[1] === null,
      talkingScoreBlankSummaryFallsBackForThatPageOnly:
        Array.isArray(talkingBlankSpan) && talkingBlankSpan[0] !== null && talkingBlankSpan[1] === null,

      // Total failure returns null, not an array of nulls: level 3 then produces
      // exactly the level-1 document by construction rather than by coincidence.
      talkingScoreNoDescribablePagesReturnsNull:
        talkingScoreAltsFor(null, [null, null], 2, stubDefaultAlt, stubSummarise) === null,
      talkingScoreStubServiceReturnsNull:
        talkingScoreAltsFor(null, RANGES_TWO, 2, stubDefaultAlt, SPAN_STUB.spanSummary) === null,
      talkingScoreAbsentTableFallsBack:
        talkingScoreAltsFor(null, null, 2, stubDefaultAlt, stubSummarise) === null,
      talkingScoreZeroPagesFallsBack:
        talkingScoreAltsFor(null, RANGES_TWO, 0, stubDefaultAlt, stubSummarise) === null,

      // ---- Stage 84: the talking-score appendix composition ----

      // THE STUB CONTRACT, on the same terms as SPAN_STUB's row above: every
      // method this module calls on MusicRenderText is declared, and the declared
      // value is the one the markup builder already reads as "no appendix".
      hasRenderTextSvc: typeof renderTextSvc === "function",
      textStubDeclaresOutlineOf:
        typeof TEXT_STUB.outlineOf === "function" && TEXT_STUB.outlineOf(null) === null,
      textStubOutlineProducesNoAppendix:
        !!globalThis.MusicPdfMarkup &&
        globalThis.MusicPdfMarkup.buildAppendixMarkup(TEXT_STUB.outlineOf(null)) === "",

      // Resolution is at CALL time, so the row asserts whichever answer this page
      // makes true rather than assuming the module loaded. The presence test is on
      // the METHOD, not the module, so a MusicRenderText predating Stage 84
      // resolves to the stub instead of throwing.
      renderTextSvcResolvesAtCallTime:
        globalThis.MusicRenderText && typeof globalThis.MusicRenderText.outlineOf === "function"
          ? renderTextSvc() === globalThis.MusicRenderText
          : renderTextSvc() === TEXT_STUB,
      renderTextSvcFallsBackWhenMethodAbsent: (function () {
        const real = globalThis.MusicRenderText;
        try {
          globalThis.MusicRenderText = { render: function () { return true; } };
          const noMethod = renderTextSvc() === TEXT_STUB;
          globalThis.MusicRenderText = undefined;
          const noModule = renderTextSvc() === TEXT_STUB;
          return noMethod && noModule;
        } finally {
          globalThis.MusicRenderText = real;
        }
      })(),
      // The positive canary for the row above: with the real module restored, the
      // resolver must stop returning the stub. Without this, a renderTextSvc that
      // ALWAYS returned TEXT_STUB would pass every fallback row on this list.
      renderTextSvcReturnsRealModuleWhenPresent:
        globalThis.MusicRenderText && typeof globalThis.MusicRenderText.outlineOf === "function"
          ? renderTextSvc() !== TEXT_STUB
          : true,

      // THE LEVEL BRANCHING. The outline is requested at talking-score and at NO
      // other level, which is what keeps levels 1 and 2 byte-identical. Asserted
      // against the same wantsPageBars predicate generate computes, so the row
      // cannot drift from the branch it describes.
      appendixRequestedOnlyAtTalkingScore:
        altTextLevelFrom({ altTextLevel: "talking-score" }) === ALT_TEXT_LEVELS.TALKING_SCORE &&
        altTextLevelFrom({ altTextLevel: "pages" }) !== ALT_TEXT_LEVELS.TALKING_SCORE &&
        altTextLevelFrom({ altTextLevel: "summary" }) !== ALT_TEXT_LEVELS.TALKING_SCORE &&
        altTextLevelFrom(undefined) !== ALT_TEXT_LEVELS.TALKING_SCORE &&
        altTextLevelFrom({ altTextLevel: "nonsense" }) !== ALT_TEXT_LEVELS.TALKING_SCORE,

      // THE DEGRADATION PATH. A module whose outlineOf throws must leave the PDF
      // exactly as level 1 would have built it, and must not propagate. This drives
      // the real resolver against a throwing module, so it exercises the branch
      // rather than a restatement of it.
      appendixThrowingOutlineDegradesToNone: (function () {
        const real = globalThis.MusicRenderText;
        try {
          globalThis.MusicRenderText = {
            outlineOf: function () { throw new Error("deliberate"); },
          };
          let outline = null;
          let threw = false;
          try {
            outline = renderTextSvc().outlineOf(null);
          } catch (e) {
            outline = null;
            threw = true;
          }
          return threw && outline === null &&
            globalThis.MusicPdfMarkup.buildAppendixMarkup(outline) === "";
        } finally {
          globalThis.MusicRenderText = real;
        }
      })(),
      appendixBadModelOutlineDegradesToNone:
        !!globalThis.MusicRenderText && typeof globalThis.MusicRenderText.outlineOf === "function"
          ? globalThis.MusicRenderText.outlineOf(null) === null &&
            globalThis.MusicPdfMarkup.buildAppendixMarkup(null) === ""
          : true,
    };

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicPdf selfTest verdict", results);
    return results;
  }

  return {
    renderPages,
    generate,
    selfTest,
  };
})();

// Attach to globalThis (not window) to mirror the Stage 15 sibling: node --check
// stays clean, and in the browser globalThis IS window, so window.MusicPdf
// resolves unchanged.
globalThis.MusicPdf = MusicPdf;
