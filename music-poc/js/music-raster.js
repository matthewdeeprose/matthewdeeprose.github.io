// music-raster.js
// The excerpt engraver and the SVG-to-PNG rasterise primitive for the Accessible
// Music proof of concept (Stage 86).
//
// Two halves, and the split is deliberate. rasteriseSvg is an EFFECTS PRIMITIVE
// recovered VERBATIM from the retired js/music-pdf-rasterise.js (last seen at
// eae6715^): it owns the canvas, it is the single home of the ~16384px
// MAX_CANVAS_DIM guard, and its behaviour is unchanged — factor still defaults to
// 3, the guard still trips at the same limit and logs the same message, it still
// fills white before drawing, and it still resolves a Uint8Array of PNG bytes or
// rejects. renderExcerptSvg is NEW: it takes a sliced MusicXML string (what
// MusicExcerpt.sliceXml hands back) and engraves it to a tight, self-sized SVG
// string under the excerpt engraving profile below.
//
// WHY THIS MODULE OWNS A SECOND VEROVIO TOOLKIT, and why that does not break the
// PDF path's invariant. js/music-pdf.js's renderPagesAndBars is the ONLY toolkit
// owner ON THE PDF PATH, and the reason is narrower than "one toolkit per app":
// the Stage 80 spike measured that Verovio's xml:ids are RANDOM PER LOAD and that
// resetXmlIdSeed does not stabilise them, so an id-to-bar map is meaningful only
// against the instance that produced it and can never be cached or rebuilt. The
// invariant is therefore "the id-to-bar map must come from the instance that
// rendered", not "only one instance may exist". THE EXCERPT PATH NEVER BUILDS
// THAT MAP — it renders one page of a slice and reads no ids at all — so the
// invariant does not bind here and a second, function-local instance is safe. The
// comment on renderPagesAndBars was corrected in the same stage to say so.
//
// The two paths also want DIFFERENT engraving options and must not be tidied into
// one: the PDF pages are paginated to a fixed page height under breaks "line"
// with smuflTextFont "linked", and an excerpt is a single self-sized system under
// breaks "none" with smuflTextFont "embedded". See EXCERPT_ENGRAVING.
//
// DEBT, logged as a board item rather than taken here: verovioToolkitReady is now
// duplicated between this file and js/music-pdf.js. Extracting a shared
// js/music-verovio.js is a stage of its own, because it touches the PDF path.
//
// BROWSER-ONLY, and attached to window rather than globalThis to say so. Both
// halves need the browser — a canvas for the raster, the Verovio wasm global for
// the engraver — so unlike its node-loadable siblings (MusicPdfMarkup,
// MusicExcerpt) there is no honest early return to reach under node. `node --check`
// stays meaningful; nothing else does. Exposed as window.MusicRaster.

const MusicRaster = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly.
  const log = window.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The browser's maximum canvas dimension. Beyond this, getContext/toBlob fail
  // silently (toBlob returns null); we guard explicitly so an over-large page
  // surfaces a clear error rather than a broken PNG. The validated scale (140)
  // keeps A4 pages well within this; the guard is the safety net.
  const MAX_CANVAS_DIM = 16384;

  // Two refusals leave rasteriseSvg, and a caller has to tell them apart to say
  // anything useful to the user: one means the range is too wide to draw at all,
  // the other means the trims typed into the crop boxes leave nothing behind.
  // Matching on the message text would be a string comparison against prose, so
  // each rejection carries a `code` and the codes are exported.
  const CANVAS_LIMIT_CODE = "CANVAS_LIMIT";
  const CROP_EMPTY_CODE = "CROP_EMPTY";

  // The excerpt engraving profile, named as one block so a reader sees the whole
  // decision at once. Every value was MEASURED by the Stage 85 spike (28 August
  // 2026, Verovio 6.2.0) rather than chosen, and each differs from the PDF path's
  // SHARED_ENGRAVING for a stated reason:
  //
  //   breaks "none"      — the whole excerpt on ONE system, and the SVG then sizes
  //                        itself to the music. This makes the page-size options
  //                        INERT: Satie bars 9-16 returned 2062x552 at pageWidth
  //                        1200, 2100, 3600 and 60000 alike. The tight crop is a
  //                        property of the mode, not something to compute, so no
  //                        page size is set here at all. (The PDF path uses "line"
  //                        and paginates to a fixed page height.)
  //   header/footer none — as on the PDF path: an excerpt image carries no running
  //                        furniture.
  //   margins 50         — margins subtract directly from the self-sized result:
  //                        50 to 0 moved 2062x552 to 1962x452, a hundred off each
  //                        axis. 50 keeps the notation off the crop edge without
  //                        the PDF path's 100, which would waste a quarter of a
  //                        small excerpt.
  //   mnumInterval 0     — the DEFAULT RULE, which on a single system prints the
  //                        first bar's number and no other. Stage 86 shipped 1
  //                        (a number on every bar) on the reasoning that an
  //                        excerpt is addressed by bar range, so the reader must
  //                        see which bars they have. **Stage 87 measured that
  //                        reasoning and reversed it**, because 1 bought nothing
  //                        and cost legibility:
  //
  //                          - 0 KEEPS THE REAL BAR NUMBER. This was the open
  //                            question, and a restart at 1 would have been worse
  //                            than any overlap — a mislabelled first bar is a
  //                            wrong answer, not an untidy one. Measured on three
  //                            ranges across two files: Satie 9-16 prints "9",
  //                            Satie 12-20 prints "12", Joplin 56-61 prints "56".
  //                            Exactly one number each, and each the true one.
  //                          - 1 COLLIDES WITH THE TEMPO TEXT. On Satie bars 1-8
  //                            the numbers 2 and 3 overprint "Lent et douloureux"
  //                            and "ca.", confirmed by eye on the 2x crop. That is
  //                            the Stage 86 board item, and 0 closes it.
  //
  //                        THE ONE COST, stated rather than discovered later: an
  //                        excerpt starting at BAR 1 prints no number at all,
  //                        because the default rule does not number the opening
  //                        bar of a piece. Measured, not assumed. Bar 1 is the
  //                        least ambiguous bar there is, and the range is named in
  //                        the alt text and the status line regardless, so the
  //                        cost is accepted. (Same value as the PDF path, reached
  //                        independently — the PDF wants it for system starts
  //                        across many pages, the excerpt for one system.)
  //   smuflTextFont
  //     "embedded"       — REQUIRED for rasterisation, and the one value that must
  //                        not be shared with the PDF. It puts an @font-face with
  //                        base64 Leipzig in the SVG (108,690 bytes against
  //                        50,426), and the glyph then rasterises; under "linked"
  //                        and "none" a metronome mark rendered as a TOFU BOX,
  //                        confirmed by eye on the 2x crop. The PDF is the mirror
  //                        image and stays "linked", because its Leipzig arrives
  //                        from the typst compiler and two sources for one font is
  //                        worse than one. A rasterised SVG has no font context at
  //                        all, so it must carry its own.
  const EXCERPT_ENGRAVING = {
    breaks: "none",
    header: "none",
    footer: "none",
    pageMarginTop: 50,
    pageMarginBottom: 50,
    pageMarginLeft: 50,
    pageMarginRight: 50,
    mnumInterval: 0,
    smuflTextFont: "embedded",
  };

  // The options Verovio ACCEPTED on the most recent renderExcerptSvg call, read
  // back off the toolkit rather than assumed. Verovio takes an unlisted option
  // value SILENTLY and keeps the default — measured at Stage 70, where "ignored"
  // was passed to smuflTextFont, whose permitted set is embedded, linked and none,
  // and nothing anywhere reported it. So an option must be read back after setting
  // it, and this is where the read-back lands so selfTest can assert on it rather
  // than on the value we hoped for. Null until the first successful mint.
  let lastApplied = null;

  // excerptOptionsFor(overrides) → the merged Verovio options for an excerpt.
  // PURE: no toolkit, no DOM, so selfTest exercises it directly. The result is a
  // fresh object, so a caller cannot mutate the shared block.
  function excerptOptionsFor(overrides) {
    return Object.assign({}, EXCERPT_ENGRAVING, overrides || {});
  }

  // lastAppliedOptions() → the read-back options object from the most recent
  // successful mint, or null. A DIAGNOSTIC accessor, not part of the render
  // contract: renderExcerptSvg still returns an SVG string or null. It exists so
  // the silent-rejection trap above can be PROVEN by a row rather than asserted in
  // this comment. Returns a copy so a reader cannot corrupt the record.
  function lastAppliedOptions() {
    return lastApplied ? Object.assign({}, lastApplied) : null;
  }

  // Wait for the Verovio wasm runtime, then resolve a fresh toolkit instance.
  // Lifted verbatim from js/music-pdf.js (which lifted it from the spike); reads
  // globalThis.verovio at CALL time so the <script> tag can provide it without
  // this file referencing it at load. The duplication is the board item named in
  // the header — extracting js/music-verovio.js touches the PDF path and is a
  // stage of its own.
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

  // readBackOptions(tk) → the toolkit's own view of its options, or null. The
  // build's getOptions has been seen to return either an object or a JSON string
  // across Verovio versions, so both are accepted and anything else is null rather
  // than a throw — a read-back that cannot be taken must not fail a render.
  function readBackOptions(tk) {
    try {
      const raw = tk.getOptions ? tk.getOptions() : null;
      if (!raw) return null;
      if (typeof raw === "string") return JSON.parse(raw);
      if (typeof raw === "object") return raw;
      return null;
    } catch (e) {
      logWarn("renderExcerptSvg: options could not be read back off the toolkit", e);
      return null;
    }
  }

  // The elements MusicXML allows inside <score-part> AFTER <part-name>. Used to
  // place a CREATED <part-name> in a schema-valid position instead of appending it
  // at the end, where a strict consumer would reject the document.
  const AFTER_PART_NAME = [
    "part-name-display",
    "part-abbreviation",
    "part-abbreviation-display",
    "group",
    "score-instrument",
    "player",
    "midi-device",
    "midi-instrument",
  ];

  // withPartDisplayNames(xmlText) → the same MusicXML with every unnamed part given
  // the display name the note list already reads, or the input unchanged when it
  // cannot be done. A <part-name> that is absent, or present but empty once trimmed,
  // is filled from MusicNames.partDisplayName("", id) — so an unnamed part prints as
  // "Part P1" rather than as Verovio's blank, and the engraved excerpt agrees with
  // the spoken description. <part-abbreviation> and <instrument-name> are NOT
  // touched: the abbreviation is what Verovio engraves beside later systems, and
  // inventing one is a different decision nobody has taken.
  //
  // Lifted from js/music-pdf.js, where Stage 94 wrote it, and duplicated here the
  // way verovioToolkitReady above is duplicated — these two files now share TWO
  // functions rather than one, and the board item named in the header (extract a
  // shared js/music-verovio.js) carries both. ONE deviation from a verbatim copy,
  // named here so a future differ is not left guessing: the success logInfo says
  // "excerpt working copy" where the sibling says "PDF working copy", because a
  // raster path logging about a PDF would be false. Everything else is the
  // sibling's, allowing for this file's LF endings against that file's CRLF.
  //
  // WHY IT LIVES HERE AND NOT IN MusicExcerpt.sliceXml, which is the other place it
  // would fit. The slicer stays a VERBATIM slicer: what it returns is the author's
  // own bars, and the copyable sliced XML the page hands the reader IS that string.
  // Filling a name there would put a word this app invented into a document the
  // reader copies out and takes away as their own. Doing it here, on the working
  // copy handed to loadData and nowhere else, means only the PIXELS gain the label
  // — the same bargain music-pdf.js strikes, where the MusicXML attached to the
  // PDF stays the author's file and only the engraved pages carry the name.
  //
  // It returns the INPUT STRING BY IDENTITY when nothing needed filling, so a score
  // whose parts are all named is not re-serialised and its excerpt PNG stays
  // byte-identical to the one this module produced before Stage 95.
  //
  // BROWSER-ONLY, like everything else in this file: it needs DOMParser and
  // XMLSerializer, and the guard below hands the input straight back without them.
  function withPartDisplayNames(xmlText) {
    if (typeof xmlText !== "string" || xmlText === "") return xmlText;

    if (typeof DOMParser === "undefined" || typeof XMLSerializer === "undefined") {
      logWarn("Part display names skipped: DOMParser/XMLSerializer unavailable (node?)");
      return xmlText;
    }
    const names = globalThis.MusicNames;
    if (!names || typeof names.partDisplayName !== "function") {
      logWarn("Part display names skipped: MusicNames.partDisplayName unavailable");
      return xmlText;
    }

    try {
      const doc = new DOMParser().parseFromString(xmlText, "application/xml");
      // A DOMParser failure surfaces as a <parsererror> element, not a throw.
      if (!doc || !doc.documentElement || doc.getElementsByTagName("parsererror").length > 0) {
        logWarn("Part display names skipped: the working copy is not well-formed XML");
        return xmlText;
      }

      const scoreParts = doc.getElementsByTagName("score-part");
      let filled = 0;

      for (let i = 0; i < scoreParts.length; i++) {
        const scorePart = scoreParts[i];
        const id = scorePart.getAttribute("id") || "";

        // Read the DIRECT child only. getElementsByTagName would reach into a
        // nested element and rename the wrong thing.
        let nameEl = null;
        for (let c = 0; c < scorePart.childNodes.length; c++) {
          const child = scorePart.childNodes[c];
          if (child.nodeType === 1 && child.tagName === "part-name") {
            nameEl = child;
            break;
          }
        }

        // A part that names itself keeps its name, whatever it says.
        if (nameEl && String(nameEl.textContent).trim().length > 0) continue;

        if (!nameEl) {
          nameEl = doc.createElement("part-name");
          let anchor = null;
          for (let c = 0; c < scorePart.childNodes.length; c++) {
            const child = scorePart.childNodes[c];
            if (child.nodeType === 1 && AFTER_PART_NAME.indexOf(child.tagName) !== -1) {
              anchor = child;
              break;
            }
          }
          // A null anchor appends, which is correct when nothing follows part-name.
          scorePart.insertBefore(nameEl, anchor);
        }

        nameEl.textContent = names.partDisplayName("", id);
        filled++;
      }

      if (filled === 0) return xmlText;
      logInfo(
        "Part display names filled for " + filled + " unnamed part(s) in the excerpt working copy"
      );
      return new XMLSerializer().serializeToString(doc);
    } catch (e) {
      logWarn("Part display names skipped: the working copy could not be rewritten", e);
      return xmlText;
    }
  }

  // renderExcerptSvg(xmlText, options) → Promise<string|null> of ONE page of SVG.
  //
  // The input is a MusicXML string that already stands on its own — in the shipped
  // chain, what MusicExcerpt.sliceXml returns, with the governing divisions, key,
  // time and clefs injected. This module does no slicing and no repair: it
  // engraves what it is given.
  //
  // options is an optional shallow override of EXCERPT_ENGRAVING, for a caller
  // that needs to vary one value; absent, the profile is used as it stands.
  //
  // NEVER THROWS. Every failure path — no Verovio global, unparseable input, an
  // engraved-empty result, loadData reporting failure, a zero page count, an empty
  // renderToSVG, or anything unforeseen — logs and resolves null, because a caller
  // of a screenshot maker wants to be told the excerpt could not be drawn, not to
  // have its own journey unwound.
  //
  // TWO GUARDS DO THE REAL WORK, because VEROVIO'S OWN RETURN VALUES CANNOT TELL
  // SUCCESS FROM SILENT FAILURE. Measured in this browser on 29 August 2026, on
  // the shipped module rather than the spike: an unparseable input and a
  // well-formed slice that re-declares nothing BOTH gave loadData reporting
  // success, getPageCount 1, and a rendered SVG of 1,169 and 1,154 bytes at
  // 100x100 with ZERO staves — the exact signature the Stage 85 spike measured on
  // naive Satie bars 9-16 (1,213 bytes, 100x100, zero staves, getLog empty). So a
  // renderer trusting loadData returns a blank page as a success:
  //
  //   INPUT GUARD  — DOMParser first. Answers the unparseable case precisely and
  //                  names it in the log, rather than letting Verovio decide.
  //   OUTPUT GUARD — zero `class="staff"` in the rendered SVG is refused. This is
  //                  the one that reaches the failure class MusicExcerpt exists to
  //                  prevent: a well-formed slice missing its governing state
  //                  engraves without a single complaint from anywhere. An excerpt
  //                  with no staff is not an excerpt, and handing it back as a
  //                  string would put a blank image in front of a reader with
  //                  nothing anywhere saying so.
  //
  // The toolkit is FUNCTION-LOCAL and dies at return, which is what makes the
  // second instance harmless: nothing is read off it that outlives the call. Only
  // page 1 is rendered, because breaks "none" puts the whole excerpt on one
  // system; a page count above 1 means the input was larger than an excerpt, and
  // that is warned rather than silently cropped.
  async function renderExcerptSvg(xmlText, options) {
    const xml = typeof xmlText === "string" ? xmlText : "";
    if (!xml.trim()) {
      logWarn("renderExcerptSvg: empty or non-string MusicXML; nothing to engrave");
      return null;
    }

    // INPUT GUARD. DOMParser is resolved at call time, so this file never touches
    // it at load; if it is somehow absent the guard stands aside rather than
    // refusing every render, and the output guard below still catches the result.
    try {
      if (typeof DOMParser === "function") {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        if (doc.getElementsByTagName("parsererror").length > 0) {
          logError("renderExcerptSvg: input is not well-formed XML; nothing engraved");
          return null;
        }
      }
    } catch (e) {
      logError("renderExcerptSvg: input could not be parsed", e);
      return null;
    }

    let tk = null;
    try {
      tk = await verovioToolkitReady();
    } catch (e) {
      logError("renderExcerptSvg: Verovio toolkit unavailable", e);
      return null;
    }

    try {
      const opts = excerptOptionsFor(options);
      tk.setOptions(opts);

      // Read back BEFORE loading data, so what is recorded is what the toolkit
      // accepted from setOptions rather than anything the document changed.
      lastApplied = readBackOptions(tk);
      if (lastApplied && lastApplied.smuflTextFont !== opts.smuflTextFont) {
        logWarn("renderExcerptSvg: Verovio kept its own smuflTextFont", {
          asked: opts.smuflTextFont,
          kept: lastApplied.smuflTextFont,
        });
      }

      // Stage 95. Name the unnamed parts in the ENGRAVER'S working copy, immediately
      // before loadData and nowhere earlier. A new binding rather than a
      // reassignment, deliberately: it keeps `xml` — the caller's string, which is
      // what MusicExcerpt handed over and what the page offers as copyable sliced
      // XML — visibly untouched, exactly as music-pdf.js keeps its own attachment
      // string. Returns its input by identity when every part is already named, so a
      // named score's excerpt is engraved from the very string it was handed.
      const labelledXml = withPartDisplayNames(xml);
      const ok = tk.loadData(labelledXml);
      if (ok === false) {
        logError("renderExcerptSvg: Verovio loadData reported failure");
        return null;
      }
      const pageCount = tk.getPageCount();
      if (!pageCount || pageCount < 1) {
        logError("renderExcerptSvg: Verovio getPageCount returned " + pageCount);
        return null;
      }
      if (pageCount > 1) {
        logWarn(
          "renderExcerptSvg: " + pageCount + " pages under breaks 'none'; only page 1 is returned"
        );
      }
      const svg = tk.renderToSVG(1); // 1-based
      if (!svg) {
        logError("renderExcerptSvg: Verovio renderToSVG(1) was empty");
        return null;
      }
      // OUTPUT GUARD. See the header block: a page with no staff on it is the
      // measured signature of a slice Verovio could not engrave, and it is the
      // ONLY signal there is — loadData, getPageCount and getLog all report
      // success. Counted on the SVG string rather than by parsing it, because an
      // embedded base64 font makes the document large and there is nothing else
      // here worth a parse.
      const staffCount = (svg.match(/class="staff"/g) || []).length;
      if (staffCount === 0) {
        logError(
          "renderExcerptSvg: engraved page carries no staff — the slice is missing its " +
            "governing state, or is not engravable. Verovio reported success throughout.",
          { bytes: svg.length }
        );
        return null;
      }
      logInfo(
        "renderExcerptSvg produced " + svg.length + " bytes of SVG across " + staffCount + " staff/staves"
      );
      return svg;
    } catch (e) {
      logError("renderExcerptSvg: engraving failed", e);
      return null;
    }
  }

  // normaliseTrims(trims) → { top, bottom, left, right } of non-negative integers,
  // or null when nothing is asked for. PURE, so selfTest exercises it directly.
  // Absent, null, all-zero and a junk object all collapse to null, which is what
  // makes "no trims" a single code path rather than four zeroes travelling
  // through the draw.
  function normaliseTrims(trims) {
    if (!trims || typeof trims !== "object") return null;
    const one = function (v) {
      const n = Math.floor(Number(v));
      return Number.isFinite(n) && n > 0 ? n : 0;
    };
    const out = {
      top: one(trims.top),
      bottom: one(trims.bottom),
      left: one(trims.left),
      right: one(trims.right),
    };
    if (!out.top && !out.bottom && !out.left && !out.right) return null;
    return out;
  }

  // rasteriseSvg(svg, factor, trims) → Promise<Uint8Array> of PNG bytes. Draws the
  // page SVG to a canvas at factor (default 3) on a white background. Lifted
  // verbatim from the spike, plus the explicit ~16384px canvas-dimension guard: if
  // a dimension would exceed the browser limit, or toBlob returns null, the error
  // is surfaced clearly (logged and rejected) rather than yielding a silent
  // broken result. The factor drops to 2 only if a larger page is ever needed.
  //
  // ORDER OF OPERATIONS, and it is a decision rather than an accident. trims are
  // OUTPUT pixels — they are subtracted from the scaled dimensions, not from the
  // SVG's own — and the MAX_CANVAS_DIM guard runs on the PRE-CROP figures, before
  // any trim is applied. So a range refused as too wide stays refused whatever
  // the trims say. That is deliberately conservative: the browser still has to
  // decode and scale the whole image to w by h to draw any part of it, and a
  // refusal message reading "too wide" must not become true or false depending on
  // an unrelated pair of numbers typed into a different control.
  //
  // The crop itself is ONE canvas, not two: the canvas is allocated at the
  // cropped size and the full image is drawn into it at a negative offset, so the
  // canvas clips. An offscreen full-size canvas plus a second extraction would
  // allocate the full bitmap twice for the same result.
  function rasteriseSvg(svg, factor, trims) {
    const scale = factor && factor >= 1 ? factor : 3;
    const trim = normaliseTrims(trims);
    let s = String(svg || "");
    if (!/xmlns\s*=/.test(s)) {
      s = s.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    return new Promise(function (resolve, reject) {
      const blob = new Blob([s], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = function () {
        try {
          const w = Math.max(1, Math.round((img.naturalWidth || 1200) * scale));
          const h = Math.max(1, Math.round((img.naturalHeight || 1600) * scale));
          if (w > MAX_CANVAS_DIM || h > MAX_CANVAS_DIM) {
            URL.revokeObjectURL(url);
            logError("rasteriseSvg: canvas dimension exceeds limit", { w, h, MAX_CANVAS_DIM });
            const err = new Error("Canvas dimension " + w + "×" + h + " exceeds the " + MAX_CANVAS_DIM + "px limit");
            err.code = CANVAS_LIMIT_CODE;
            reject(err);
            return;
          }

          // Post-crop size. A trim pair that meets or crosses the opposite edge
          // leaves nothing to draw, and an empty canvas is not a smaller image —
          // it is no image — so it is refused with its OWN code rather than
          // clamped to 1px, which would hand back something nobody asked for.
          const cw = trim ? w - trim.left - trim.right : w;
          const ch = trim ? h - trim.top - trim.bottom : h;
          if (cw <= 0 || ch <= 0) {
            URL.revokeObjectURL(url);
            logError("rasteriseSvg: trims leave no image", { w, h, trim, cw, ch });
            const err = new Error("Trims leave a " + cw + "×" + ch + " image, which is empty");
            err.code = CROP_EMPTY_CODE;
            reject(err);
            return;
          }

          const canvas = document.createElement("canvas");
          canvas.width = cw;
          canvas.height = ch;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, cw, ch);
          // Negative offset when trimmed, (0, 0) when not, so the untrimmed call
          // is byte-for-byte the draw it always was.
          ctx.drawImage(img, trim ? -trim.left : 0, trim ? -trim.top : 0, w, h);
          URL.revokeObjectURL(url);
          canvas.toBlob(function (pngBlob) {
            if (!pngBlob) {
              logError("rasteriseSvg: canvas.toBlob returned null");
              reject(new Error("canvas.toBlob returned null"));
              return;
            }
            pngBlob
              .arrayBuffer()
              .then(function (buf) {
                resolve(new Uint8Array(buf));
              })
              .catch(reject);
          }, "image/png");
        } catch (e) {
          URL.revokeObjectURL(url);
          reject(e);
        }
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("SVG failed to load as an image (bad markup or unembedded font)"));
      };
      img.src = url;
    });
  }

  // A hand-built minimal MusicXML in the SHAPE a slice comes back in: one part,
  // one measure, and an <attributes> carrying the governing divisions, key, time
  // and clef, which is exactly what MusicExcerpt injects into a first kept bar. It
  // is deliberately NOT a corpus fixture — the point is that renderExcerptSvg
  // engraves what it is given, with no fixture-specific behaviour anywhere.
  const MINIMAL_SLICE =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="3.1">' +
    '<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>' +
    '<part id="P1"><measure number="1">' +
    "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
    "<time><beats>4</beats><beat-type>4</beat-type></time>" +
    "<clef><sign>G</sign><line>2</line></clef></attributes>" +
    "<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>" +
    "</measure></part></score-partwise>";

  // The NEGATIVE CONTROL for the output guard: the SAME fixture with its
  // <attributes> removed, which is the naive-slice shape — well-formed MusicXML
  // whose measure re-declares nothing. It exists because the guard's positive row
  // and its negative row are only meaningful as a pair: a guard that refused
  // everything would look exactly like a guard that was working, and so would one
  // that refused nothing, since both inputs are valid XML and Verovio reports
  // success on both. Measured in-browser 29 August 2026: this engraves to 1,154
  // bytes at 100x100 with zero staves, against the slice above at 5,671 bytes,
  // 526x280 and one staff.
  const NAIVE_SLICE =
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<score-partwise version="3.1">' +
    '<part-list><score-part id="P1"><part-name>Music</part-name></score-part></part-list>' +
    '<part id="P1"><measure number="9">' +
    "<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>" +
    "</measure></part></score-partwise>";

  // svgRootDims(svg) → { w, h } off the SVG's own root width/height attributes, or
  // null. Read by regex on the root tag rather than by parsing the whole document,
  // because an embedded base64 font makes the string large and there is nothing
  // else here worth parsing.
  function svgRootDims(svg) {
    if (typeof svg !== "string") return null;
    const root = svg.match(/<svg\b[^>]*>/i);
    if (!root) return null;
    const w = root[0].match(/\bwidth="(\d+(?:\.\d+)?)/i);
    const h = root[0].match(/\bheight="(\d+(?:\.\d+)?)/i);
    if (!w || !h) return null;
    return { w: Number(w[1]), h: Number(h[1]) };
  }

  // selfTest — BROWSER-ONLY (needs document, a canvas and the Verovio global).
  // Async because both halves are async. Builds a results object, console.table()s
  // it and returns it (the resolved value of the promise).
  async function selfTest() {
    const tinySvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4" fill="#000"/></svg>';

    // --- The rows recovered with the primitive, plus the guard's positive control ---

    // Rasterise a tiny SVG and check the PNG magic (0x89 0x50 0x4E 0x47).
    let pngMagicOk = false;
    try {
      const bytes = await rasteriseSvg(tinySvg);
      pngMagicOk =
        bytes instanceof Uint8Array &&
        bytes.length > 0 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47;
    } catch (e) {
      logError("selfTest: rasteriseSvg on tiny SVG failed", e);
    }

    // The guard, proved as a PAIR either side of the limit rather than by one
    // absurd factor. The 4x4 fixture at 4200 asks for 16800px and must be refused;
    // at 4000 it asks for 16000px and must succeed. Without the second row a guard
    // that refused EVERYTHING would read exactly like a guard that was working —
    // and so would a rasteriseSvg that had stopped rasterising at all.
    let guardSurfaced = false;
    try {
      const over = await rasteriseSvg(tinySvg, 4200);
      guardSurfaced = over === null;
    } catch (e) {
      guardSurfaced = true;
    }
    let underLimitStillRasterises = false;
    try {
      const under = await rasteriseSvg(tinySvg, 4000);
      underLimitStillRasterises = under instanceof Uint8Array && under.length > 0;
    } catch (e) {
      logError("selfTest: rasteriseSvg just under the limit failed", e);
    }

    // --- Stage 88: the crop ------------------------------------------------
    // Dimensions are read from the PNG's own IHDR (big-endian at bytes 16-23),
    // the same way music-app reports them, so a row asserts the FILE rather than
    // the arithmetic that was meant to produce it.
    const pngDims = function (bytes) {
      if (!(bytes instanceof Uint8Array) || bytes.length < 24) return null;
      const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      return { w: v.getUint32(16), h: v.getUint32(20) };
    };

    // The 4x4 fixture at 4x is a 16x16 output. Trimming 2 off the top, 2 off the
    // bottom, 3 off the left and 3 off the right must leave 10 by 12 — which is
    // also the row that pins the UNITS: trims are output pixels, subtracted from
    // the scaled size, not SVG units subtracted before scaling. Were they SVG
    // units this would come back 16 - 4*6 = negative and refuse instead.
    let trimDims = null;
    try {
      trimDims = pngDims(await rasteriseSvg(tinySvg, 4, { top: 2, bottom: 2, left: 3, right: 3 }));
    } catch (e) {
      logError("selfTest: rasteriseSvg with trims failed", e);
    }

    // Trims absent must behave EXACTLY as before, and "exactly" is asserted on
    // the bytes rather than on the dimensions: a crop path that quietly redrew
    // the untrimmed case through the offset draw would still report 16x16.
    let untrimmedIdentical = false;
    let allZeroIdentical = false;
    try {
      const plain = await rasteriseSvg(tinySvg, 4);
      const again = await rasteriseSvg(tinySvg, 4);
      const zeros = await rasteriseSvg(tinySvg, 4, { top: 0, bottom: 0, left: 0, right: 0 });
      const same = function (a, b) {
        if (!(a instanceof Uint8Array) || !(b instanceof Uint8Array) || a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
        return true;
      };
      // The control: two untrimmed calls agree with each other, so a byte
      // comparison that could never match anything cannot pass by being empty.
      untrimmedIdentical = same(plain, again) && plain.length > 0;
      allZeroIdentical = untrimmedIdentical && same(plain, zeros);
    } catch (e) {
      logError("selfTest: untrimmed byte comparison failed", e);
    }

    // The zero-size refusal, as a PAIR with the row above it in the same way the
    // canvas guard is: 8 and 8 off a 16-tall image leaves nothing and must be
    // refused, while 7 and 7 leaves 2 and must still rasterise.
    let cropEmptyRefused = false;
    let cropEmptyCode = false;
    try {
      const empty = await rasteriseSvg(tinySvg, 4, { top: 8, bottom: 8 });
      cropEmptyRefused = empty === null;
    } catch (e) {
      cropEmptyRefused = true;
      cropEmptyCode = e && e.code === CROP_EMPTY_CODE;
    }
    let justInsideCropStillRasterises = false;
    try {
      const near = pngDims(await rasteriseSvg(tinySvg, 4, { top: 7, bottom: 7 }));
      justInsideCropStillRasterises = !!near && near.w === 16 && near.h === 2;
    } catch (e) {
      logError("selfTest: rasteriseSvg just inside the crop limit failed", e);
    }

    // The dimension guard measures the PRE-CROP size, so trims cannot rescue an
    // over-large range. Two rows, because the claim has two halves and the first
    // version of this block proved only the weaker one.
    //
    // The fixture is WIDE AND SHORT on purpose: 100 by 4 at 165x is 16500 by 660,
    // so only the WIDTH breaches the ceiling, and trimming 8100 off each side
    // leaves 300 by 660 — comfortably legal. A guard reading the post-crop
    // figures would therefore allocate a small canvas and succeed. Measured 29
    // August 2026: an inversion moving the guard below the crop makes this row
    // red, which the earlier trim-one-axis version did NOT, because the untrimmed
    // height still breached and the guard fired for the wrong reason.
    const wideSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="4"><rect width="100" height="4" fill="#000"/></svg>';
    let guardMeasuresPreCropSize = false;
    try {
      await rasteriseSvg(wideSvg, 165, { left: 8100, right: 8100 });
    } catch (e) {
      guardMeasuresPreCropSize = e && e.code === CANVAS_LIMIT_CODE;
    }
    // And the guard is reached BEFORE the empty-crop check, so a range that is
    // both too wide AND over-trimmed is reported as too wide — the condition the
    // user has to fix first.
    let dimensionGuardBeatsCrop = false;
    try {
      await rasteriseSvg(tinySvg, 4200, { top: 99999, bottom: 99999 });
    } catch (e) {
      dimensionGuardBeatsCrop = e && e.code === CANVAS_LIMIT_CODE;
    }

    // --- The excerpt engraver ---

    const excerptSvg = await renderExcerptSvg(MINIMAL_SLICE);
    const dims = svgRootDims(excerptSvg);
    const applied = lastAppliedOptions();

    const results = {
      hasRasteriseSvg: typeof rasteriseSvg === "function",
      hasRenderExcerptSvg: typeof renderExcerptSvg === "function",
      hasExcerptOptionsFor: typeof excerptOptionsFor === "function",
      hasLastAppliedOptions: typeof lastAppliedOptions === "function",
      hasSelfTest: typeof selfTest === "function",

      // The engraving profile, asserted where a reader can see it. These are the
      // spike's measured values; a silent edit to EXCERPT_ENGRAVING reddens here.
      profileBreaksNone: EXCERPT_ENGRAVING.breaks === "none",
      profileHeaderFooterNone:
        EXCERPT_ENGRAVING.header === "none" && EXCERPT_ENGRAVING.footer === "none",
      profileMarginsFifty:
        EXCERPT_ENGRAVING.pageMarginTop === 50 &&
        EXCERPT_ENGRAVING.pageMarginBottom === 50 &&
        EXCERPT_ENGRAVING.pageMarginLeft === 50 &&
        EXCERPT_ENGRAVING.pageMarginRight === 50,
      profileMnumIntervalZero: EXCERPT_ENGRAVING.mnumInterval === 0,
      profileSmuflEmbedded: EXCERPT_ENGRAVING.smuflTextFont === "embedded",
      // The PDF path's own value is the OPPOSITE and must stay so: both settings
      // are correct for their own output and must not be tidied into one.
      profileDiffersFromPdfPath: EXCERPT_ENGRAVING.smuflTextFont !== "linked",
      optionsMergeIsFresh: (function () {
        const a = excerptOptionsFor({ mnumInterval: 9 });
        return a.mnumInterval === 9 && EXCERPT_ENGRAVING.mnumInterval === 0;
      })(),

      rasterisePngMagicOk: pngMagicOk,
      canvasGuardSurfaced: guardSurfaced,
      underLimitStillRasterises: underLimitStillRasterises,

      // Stage 88: the crop. normaliseTrims is pure, so it is asserted directly —
      // absent, null, a junk value and an all-zero object must ALL collapse to
      // null, because "no trims" has to be one code path and not four zeroes
      // travelling through the draw. Negatives and fractions clamp rather than
      // reaching the canvas.
      hasNormaliseTrims: typeof normaliseTrims === "function",
      trimsAbsentNormaliseToNull:
        normaliseTrims() === null &&
        normaliseTrims(null) === null &&
        normaliseTrims(7) === null &&
        normaliseTrims({ top: 0, bottom: 0, left: 0, right: 0 }) === null,
      trimsNegativeAndFractionalClamp: (function () {
        const t = normaliseTrims({ top: -5, bottom: 2.9, left: "3", right: NaN });
        return !!t && t.top === 0 && t.bottom === 2 && t.left === 3 && t.right === 0;
      })(),
      trimsAppliedInOutputPixels: !!trimDims && trimDims.w === 10 && trimDims.h === 12,
      untrimmedIsByteStable: untrimmedIdentical,
      allZeroTrimsAreByteIdenticalToNoTrims: allZeroIdentical,
      cropEmptyRefused: cropEmptyRefused,
      cropEmptyCarriesItsOwnCode: cropEmptyCode,
      justInsideCropStillRasterises: justInsideCropStillRasterises,
      dimensionGuardMeasuresPreCropSize: guardMeasuresPreCropSize,
      dimensionGuardRunsBeforeCropCheck: dimensionGuardBeatsCrop,
      refusalCodesAreDistinct: CANVAS_LIMIT_CODE !== CROP_EMPTY_CODE,

      excerptReturnsSvgString:
        typeof excerptSvg === "string" && /^<\?xml|^<svg/i.test(excerptSvg.trim()),
      excerptRootDimsReadable: !!dims && dims.w > 0 && dims.h > 0,
      // Pinned to the MEASURED figures for MINIMAL_SLICE under this profile, read
      // off a live run rather than predicted. A profile change moves them, which is
      // the point: this row is what stops the block above drifting silently. The
      // first value written here WAS a prediction — 610x460, lifted from the plan's
      // Satie one-bar figure — and it reddened on the first run, which is the
      // discipline working and the reason the number is now measured.
      excerptRootDimsAsMeasured: !!dims && dims.w === 526 && dims.h === 280,
      // The silent-rejection trap: Verovio keeps its own default for an unlisted
      // value and reports nothing, so the row asserts the toolkit's OWN read-back
      // rather than what was asked for.
      excerptSmuflReadBackEmbedded: !!applied && applied.smuflTextFont === "embedded",
      excerptSmuflReadBackNotAssumed: !!applied && applied.breaks === "none",

      excerptNullOnJunk: (await renderExcerptSvg("not xml at all")) === null,
      excerptNullOnUnparseableXml:
        (await renderExcerptSvg('<?xml version="1.0"?><score-partwise><part id=')) === null,
      excerptNullOnEmpty: (await renderExcerptSvg("")) === null,

      // The output guard, as a PAIR. The negative row alone proves nothing: an
      // engraver that had stopped engraving would refuse the naive slice for the
      // wrong reason and read identically here. The positive row above
      // (excerptReturnsSvgString) is its control, and this row names the
      // measurement that separates the two inputs — one staff against none, on
      // documents Verovio reports success for alike.
      excerptNullOnNaiveSlice: (await renderExcerptSvg(NAIVE_SLICE)) === null,
      naiveSliceIsItselfWellFormed: (function () {
        const d = new DOMParser().parseFromString(NAIVE_SLICE, "application/xml");
        return d.getElementsByTagName("parsererror").length === 0;
      })(),
      goodSliceCarriesAStaff:
        typeof excerptSvg === "string" && (excerptSvg.match(/class="staff"/g) || []).length === 1,

      excerptNeverThrows: true, // reaching this line at all is the assertion
    };

    // ---- Stage 95 (the part-name working copy) ----
    //
    // The same five fixture behaviours js/music-pdf.js asserts on its own copy, plus
    // the has-function row. UNLIKE that suite these need no node branch: this whole
    // module is browser-only — it reads window.MusicLog at load and cannot be
    // required under node at all — so DOMParser and XMLSerializer are present
    // wherever this function runs, and a node-guard row here could only ever pass
    // vacuously. `node --check` remains the only node gate this file has, and it is
    // unchanged by this stage.
    results.hasWithPartDisplayNames = typeof withPartDisplayNames === "function";

    const scoreWith = function (partListInner) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="4.0"><part-list>' + partListInner + '</part-list>' +
        '<part id="P1"><measure number="1"/></part></score-partwise>'
      );
    };
    // Read a value back out of the RESULT rather than matching on the serialised
    // string: an empty element may serialise as <part-name/> or <part-name></part-name>
    // and a row asserting either spelling would be testing the serialiser.
    const readBackText = function (xmlOut, tag, index) {
      const d = new DOMParser().parseFromString(xmlOut, "application/xml");
      const els = d.getElementsByTagName(tag);
      return els.length > (index || 0) ? String(els[index || 0].textContent) : null;
    };

    const EMPTY_NAME = scoreWith('<score-part id="P1"><part-name></part-name></score-part>');
    const ABSENT_NAME = scoreWith('<score-part id="P2"><score-instrument id="P2-I1"/></score-part>');
    const REAL_NAME = scoreWith('<score-part id="P1"><part-name>Piano</part-name></score-part>');
    const WITH_ABBREV = scoreWith(
      '<score-part id="P1"><part-name></part-name><part-abbreviation>Pno.</part-abbreviation></score-part>'
    );
    // Unclosed elements: DOMParser reports this as a <parsererror> document.
    const MALFORMED = '<score-partwise><part-list><score-part id="P1">';

    const abbrevOut = withPartDisplayNames(WITH_ABBREV);

    results.partNamesEmptyGainsFallback =
      readBackText(withPartDisplayNames(EMPTY_NAME), "part-name", 0) === "Part P1";
    // The absent case must CREATE the element, so the count moves from 0 to 1 as
    // well as the text being right; a row on the text alone would pass if the
    // helper had somehow renamed a different element.
    results.partNamesAbsentGainsFallback = (function () {
      const countBefore = new DOMParser()
        .parseFromString(ABSENT_NAME, "application/xml")
        .getElementsByTagName("part-name").length;
      const out = withPartDisplayNames(ABSENT_NAME);
      const countAfter = new DOMParser()
        .parseFromString(out, "application/xml")
        .getElementsByTagName("part-name").length;
      return (
        countBefore === 0 && countAfter === 1 && readBackText(out, "part-name", 0) === "Part P2"
      );
    })();
    // A real name is returned BY IDENTITY, which is the property that keeps a named
    // score's excerpt PNG byte-identical rather than merely equivalent.
    results.partNamesRealNameUntouched =
      withPartDisplayNames(REAL_NAME) === REAL_NAME &&
      readBackText(REAL_NAME, "part-name", 0) === "Piano";
    results.partNamesAbbreviationUntouched =
      readBackText(abbrevOut, "part-abbreviation", 0) === "Pno." &&
      readBackText(abbrevOut, "part-name", 0) === "Part P1";
    results.partNamesParserErrorReturnsUnchanged =
      withPartDisplayNames(MALFORMED) === MALFORMED;

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicRaster selfTest verdict", results);
    return results;
  }

  return {
    rasteriseSvg,
    normaliseTrims,
    CANVAS_LIMIT_CODE,
    CROP_EMPTY_CODE,
    renderExcerptSvg,
    excerptOptionsFor,
    lastAppliedOptions,
    selfTest,
  };
})();

// Attach to window (not globalThis) deliberately, following MusicRenderScore: both
// halves are browser-only — a canvas for the raster, the Verovio wasm global for
// the engraver — so unlike MusicPdfMarkup and MusicExcerpt there is no honest
// dependency-absent early return to reach under node. `node --check` is the only
// meaningful node use of this file.
window.MusicRaster = MusicRaster;
