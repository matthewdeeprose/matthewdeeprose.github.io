// music-excerpt.js
// The pure MusicXML slicer for the Accessible Music proof of concept (Stage 85).
//
// A PURE STRING TRANSFORM, structural sibling of js/music-transpose.js's
// transposeXml: it takes a MusicXML string and a bar range, keeps the header, the
// part-list and the measures in range on every part, drops the rest, and hands
// back a MusicXML string. It touches no page DOM — DOMParser and XMLSerializer on
// the passed text only — never throws, and returns null on any failure. Its only
// collaborator is logging. It knows nothing about Verovio, canvases, PNGs or the
// page; a caller renders the string it returns. Exposed as globalThis.MusicExcerpt.
//
// WHY THE INJECTOR EXISTS, and why it is not decorative. A MusicXML measure
// inherits state from the measures before it — divisions, key, time, staves,
// clef per staff, transpose — and none of that is restated on a bar that simply
// carries on. Cut a range out and the first kept bar loses all of it. Measured on
// 28 August 2026 against the two corpus fixtures, at Verovio 6.2.0:
//
//   - Satie bars 9-16 with nothing re-declared: loadData() returned SUCCESS,
//     getPageCount() returned 1, getLog() was EMPTY, and the rendered SVG was
//     1,213 bytes at 100x100 with zero staves. The only signal anywhere was one
//     console warning from the wasm module. Re-declaring the governing state gave
//     2062x552, sixteen staff elements, both clefs, and zero warnings.
//   - Joplin bars 55-60 is the case that decides the design. Bar 55 happens to
//     carry an <attributes> of its own (its key change), so Verovio raised NO
//     warning at all and engraved a page that LOOKS like music — with no clef and
//     no time signature, and every left-hand note drawn six staff-spaces out of
//     place, because an unclefed staff reads as treble. Nothing on the page says
//     so. That is the failure this module exists to prevent, and it is why the
//     selfTest carries a negative control: an injector that had quietly stopped
//     working would look exactly like one that was working.
//
// TWO DELIBERATE OMISSIONS, both decisions rather than gaps.
//
//   - DIRECTIONS IN FORCE ARE NOT INJECTED. The dynamic, tempo words and
//     metronome mark governing the first kept bar are inherited state too, and
//     Verovio never complains about their absence: measured on Satie, an excerpt
//     of bars 9-12 carries zero dynamics, zero words and zero <sound tempo> and
//     engraves cleanly. They are deliberately left out (decision (b)): the
//     excerpt stays the author's PRINTED NOTATION, and the description layer
//     carries the surrounding context at Stage 87. Adding them here would put
//     marks on the page the composer did not write there.
//   - CUT TIES AND SLURS ARE LEFT CUT. A range that starts or ends mid-span makes
//     Verovio log "There are N ties left open" to the console. That warning is
//     EXPECTED and is not a defect in this module: the tie really is cut, because
//     the user asked for those bars. It is left visible rather than suppressed.
//
// LIMITS, stated rather than discovered later: a per-staff <key number="n"> is
// treated as one key for the part (clefs are the only per-staff slot handled),
// and score-timewise documents are refused rather than half-supported.
//
// NODE: the module LOADS under node — DOMParser is resolved at call time, never
// at load — but node has no DOMParser, so sliceXml returns null there and
// selfTest reports the surface rows plus domParserPresent:false and returns
// early, exactly as MusicMxl's selfTest does without JSZip. Under node only
// `node --check` and that early return are meaningful; the slicing rows are
// BROWSER-ONLY. It attaches to globalThis rather than window (the
// MusicPdfMarkup pattern) so that early return is reachable at all; in the
// browser globalThis IS window, so window.MusicExcerpt resolves unchanged.

const MusicExcerpt = (function () {
  "use strict";

  // Consumer-side logging: route through the shared MusicLog when present,
  // otherwise fall back to silent no-ops so this file never logs directly. Read
  // from globalThis (not window) so the shim resolves under node as well.
  const log = globalThis.MusicLog || { logError() {}, logWarn() {}, logInfo() {}, logDebug() {} };
  const { logError, logWarn, logInfo, logDebug } = log;

  // The only document layout this module handles. score-timewise nests measures
  // above parts, so every walk below would read the wrong axis; it is refused.
  const SUPPORTED_ROOT = "score-partwise";

  // A <clef> with no number attribute governs staff 1. MusicXML makes the
  // attribute optional on a single-staff part, and Joplin's two parts both omit
  // it, so the fallback is the ordinary case rather than an edge.
  const DEFAULT_CLEF_STAFF = "1";

  // The MusicXML content order for the children of <attributes>, as a frozen
  // rank rather than bare numbers at the point of use. Injection appends and then
  // sorts by this, so a document that arrives ordered leaves ordered and one that
  // gains elements does not end up with a clef before its divisions. Anything not
  // listed sorts after everything listed, keeping its relative order (the sort is
  // stable), so an unrecognised child is carried rather than dropped or reordered
  // among its own kind.
  const ATTRIBUTE_RANK = Object.freeze({
    divisions: 0,
    key: 1,
    time: 2,
    staves: 3,
    "part-symbol": 4,
    instruments: 5,
    clef: 6,
    "staff-details": 7,
    transpose: 8,
    directive: 9,
    "measure-style": 10,
  });
  const UNRANKED = 99;

  // The single-value inherited slots, in the order they are injected. Clefs are
  // handled separately because they are keyed per staff, not one per part.
  const SINGLE_SLOTS = Object.freeze(["divisions", "key", "time", "staves", "transpose"]);

  // The measure children that consume musical time. Meeting one means the bar has
  // begun, so any <attributes> after it is a MID-BAR change rather than the bar's
  // opening declaration — which is how openingAttributesOf tells the two apart.
  const MEASURE_EVENT_TAGS = Object.freeze(["note", "backup", "forward"]);

  // ---------------------------------------------------------------------------
  // Small DOM helpers. childrenNamed is used in place of querySelectorAll(":scope
  // > x") throughout: it reads only direct children, which is what every walk here
  // means, and it cannot be satisfied by a nested element of the same name (a
  // <divisions> inside some other wrapper must never answer for a measure's own).
  // ---------------------------------------------------------------------------

  function childrenNamed(el, name) {
    const out = [];
    if (!el || !el.children) return out;
    for (let i = 0; i < el.children.length; i++) {
      if (el.children[i].tagName === name) out.push(el.children[i]);
    }
    return out;
  }

  // The measures of one part, in document order.
  function measuresOf(partEl) {
    return childrenNamed(partEl, "measure");
  }

  // The parts of a score-partwise document, in document order.
  function partsOf(doc) {
    return doc && doc.documentElement ? childrenNamed(doc.documentElement, "part") : [];
  }

  // ---------------------------------------------------------------------------
  // Parsing. Both browser globals are resolved at CALL time so the module loads
  // under node; absence is reported once and turns into a null return rather than
  // a throw.
  // ---------------------------------------------------------------------------

  function domAvailable() {
    return typeof DOMParser !== "undefined" && typeof XMLSerializer !== "undefined";
  }

  // parseScore(xmlText) -> a score-partwise Document, or null. Refuses anything
  // that is not well-formed, is not score-partwise, or carries no <part>. A
  // DOMParser failure surfaces as a <parsererror> element rather than a throw, so
  // it is checked for explicitly.
  function parseScore(xmlText) {
    if (typeof xmlText !== "string" || xmlText.trim() === "") {
      logWarn("MusicExcerpt: sliceXml needs a non-empty MusicXML string");
      return null;
    }
    if (!domAvailable()) {
      logError("MusicExcerpt: DOMParser/XMLSerializer unavailable (node?); cannot slice");
      return null;
    }
    const doc = new DOMParser().parseFromString(xmlText, "application/xml");
    if (!doc || !doc.documentElement || doc.getElementsByTagName("parsererror").length > 0) {
      logWarn("MusicExcerpt: input is not well-formed XML");
      return null;
    }
    if (doc.documentElement.tagName !== SUPPORTED_ROOT) {
      logWarn(
        "MusicExcerpt: only " + SUPPORTED_ROOT + " is handled; got '" + doc.documentElement.tagName + "'"
      );
      return null;
    }
    if (partsOf(doc).length === 0) {
      logWarn("MusicExcerpt: document carries no <part>");
      return null;
    }
    return doc;
  }

  // ---------------------------------------------------------------------------
  // The backward walk.
  // ---------------------------------------------------------------------------

  // declarationsIn(measureEl) -> what THIS measure declares, with a later
  // declaration inside the same measure beating an earlier one (a mid-bar change
  // is the last word on that bar). Every value is a live element reference, never
  // a clone; the injector clones at the point of use.
  function declarationsIn(measureEl) {
    const found = { divisions: null, key: null, time: null, staves: null, transpose: null, clefs: {} };
    const attributeEls = childrenNamed(measureEl, "attributes");
    for (let a = 0; a < attributeEls.length; a++) {
      const kids = attributeEls[a].children;
      for (let i = 0; i < kids.length; i++) {
        const el = kids[i];
        if (el.tagName === "clef") {
          found.clefs[el.getAttribute("number") || DEFAULT_CLEF_STAFF] = el;
        } else if (Object.prototype.hasOwnProperty.call(found, el.tagName)) {
          found[el.tagName] = el;
        }
      }
    }
    return found;
  }

  // governingState(doc, partId, beforeMeasureEl) -> the state in force
  // immediately BEFORE beforeMeasureEl, walked backwards through the raw XML of
  // that part: the latest divisions, key, time, staves and transpose, plus the
  // latest clef for EACH staff number, since a two-staff part declares one clef
  // per staff and they need not be declared in the same bar.
  //
  // Backwards rather than forwards on purpose: the answer wanted is the LATEST
  // declaration before the bar, so the first one met walking back is the one that
  // governs, and each slot is filled once and then left alone.
  //
  // Exposed for testability, and read from the raw XML rather than from the
  // parsed model deliberately. The model cannot answer this question: its
  // structure layer reads querySelector("clef"), the FIRST clef only, and is
  // commented single-staff, so Satie's bass clef is invisible to it; its
  // divisions is a single document-root value; and its keyChange/clefChange are
  // guarded on m > 0, so bar 1's own declarations — exactly the state a bar-9
  // excerpt needs — are deliberately not recorded there.
  //
  // Returns null on bad arguments (no such part, or a measure that is not a child
  // of it) rather than an empty state, so a caller cannot mistake "nothing was
  // declared" for "you asked the wrong question". Values are live references into
  // doc; the caller must clone before inserting them anywhere.
  function governingState(doc, partId, beforeMeasureEl) {
    if (!doc || !beforeMeasureEl) {
      logWarn("MusicExcerpt: governingState needs a document and a measure element");
      return null;
    }
    let partEl = null;
    if (partId === null || partId === undefined) {
      partEl = beforeMeasureEl.parentNode;
    } else {
      const parts = partsOf(doc);
      for (let i = 0; i < parts.length; i++) {
        if (parts[i].getAttribute("id") === partId) {
          partEl = parts[i];
          break;
        }
      }
    }
    if (!partEl || partEl.tagName !== "part") {
      logWarn("MusicExcerpt: governingState found no part for id '" + partId + "'");
      return null;
    }
    const measures = measuresOf(partEl);
    const stopAt = measures.indexOf(beforeMeasureEl);
    if (stopAt === -1) {
      logWarn("MusicExcerpt: governingState was given a measure that is not in that part");
      return null;
    }

    const state = { divisions: null, key: null, time: null, staves: null, transpose: null, clefs: {} };
    for (let i = stopAt - 1; i >= 0; i--) {
      const declared = declarationsIn(measures[i]);
      for (let s = 0; s < SINGLE_SLOTS.length; s++) {
        const slot = SINGLE_SLOTS[s];
        if (state[slot] === null && declared[slot] !== null) state[slot] = declared[slot];
      }
      const staffNumbers = Object.keys(declared.clefs);
      for (let c = 0; c < staffNumbers.length; c++) {
        const number = staffNumbers[c];
        if (!Object.prototype.hasOwnProperty.call(state.clefs, number)) {
          state.clefs[number] = declared.clefs[number];
        }
      }
    }
    return state;
  }

  // ---------------------------------------------------------------------------
  // Injection.
  // ---------------------------------------------------------------------------

  // The <attributes> element that governs the START of a measure, decided
  // POSITIONALLY: the first attributes child met before the first note, backup or
  // forward, and null once an event has been passed. A mid-bar change must never
  // count as "the bar already declares this" — if it did, a bar that changes clef
  // half way through would suppress the injection of the clef it STARTS with, and
  // open with no clef at all.
  //
  // Null is the answer for a bar whose only attributes element is mid-bar, and
  // injectGoverning's existing null path then creates a NEW leading attributes
  // element for the governing state and front-inserts it, leaving the mid-bar
  // change untouched with only its own children. So the bar opens correctly
  // clefed and still changes clef where the author wrote the change.
  //
  // This rule was FIRST WRITTEN as "the first attributes child", which reads the
  // same until the bar has no bar-start attributes at all — then the first child
  // IS the mid-bar one, and the comment above described an invariant the code did
  // not hold: the governing divisions, key and time were appended INTO the mid-bar
  // element after the first note, the clef was skipped as already declared, and
  // the excerpt engraved cleanly with an unclefed opening. Caught by a verdict
  // re-derivation on 28 August 2026; zero bars of that shape exist across the
  // eight sample files, so it was latent rather than live. The two rows named
  // midBarOnly* in selfTest exist to keep the comment and the code honest with
  // each other.
  function openingAttributesOf(measureEl) {
    if (!measureEl || !measureEl.children) return null;
    for (let i = 0; i < measureEl.children.length; i++) {
      const el = measureEl.children[i];
      if (el.tagName === "attributes") return el;
      if (MEASURE_EVENT_TAGS.indexOf(el.tagName) !== -1) return null;
    }
    return null;
  }

  // injectGoverning(measureEl, state) -> an array of labels for what was added
  // ("divisions", "key", ..., "clef:2"), for logging and for the selfTest.
  //
  // Anything the bar ALREADY declares at its start wins and is left untouched:
  // that is the Joplin bar 55 case, where the bar's own key change is the whole
  // point of the excerpt and must not be overwritten by the key it changed from.
  function injectGoverning(measureEl, state) {
    if (!measureEl || !state) return [];
    const doc = measureEl.ownerDocument;
    const added = [];

    let attributesEl = openingAttributesOf(measureEl);
    if (!attributesEl) {
      attributesEl = doc.createElement("attributes");
      measureEl.insertBefore(attributesEl, measureEl.firstChild);
    }

    for (let s = 0; s < SINGLE_SLOTS.length; s++) {
      const slot = SINGLE_SLOTS[s];
      if (state[slot] === null) continue;
      if (childrenNamed(attributesEl, slot).length > 0) continue;
      attributesEl.appendChild(state[slot].cloneNode(true));
      added.push(slot);
    }

    // Clefs, per staff number: a staff the bar already clefs keeps its own, and
    // any staff it does not is given the one in force. Sorted so the injected
    // order is deterministic rather than dependent on key iteration.
    const declaredStaves = {};
    const existingClefs = childrenNamed(attributesEl, "clef");
    for (let i = 0; i < existingClefs.length; i++) {
      declaredStaves[existingClefs[i].getAttribute("number") || DEFAULT_CLEF_STAFF] = true;
    }
    const wanted = Object.keys(state.clefs).sort();
    for (let i = 0; i < wanted.length; i++) {
      const number = wanted[i];
      if (declaredStaves[number]) continue;
      attributesEl.appendChild(state.clefs[number].cloneNode(true));
      added.push("clef:" + number);
    }

    reorderAttributes(attributesEl);
    return added;
  }

  // Sort the children of one <attributes> into MusicXML content order. Appending
  // is what puts them out of order in the first place, so this runs after every
  // injection. Re-appending an existing child MOVES it, which is how the sort is
  // applied without rebuilding the element.
  function reorderAttributes(attributesEl) {
    const kids = [];
    for (let i = 0; i < attributesEl.children.length; i++) kids.push(attributesEl.children[i]);
    kids.sort(function (a, b) {
      const ra = ATTRIBUTE_RANK[a.tagName] === undefined ? UNRANKED : ATTRIBUTE_RANK[a.tagName];
      const rb = ATTRIBUTE_RANK[b.tagName] === undefined ? UNRANKED : ATTRIBUTE_RANK[b.tagName];
      return ra - rb;
    });
    for (let i = 0; i < kids.length; i++) attributesEl.appendChild(kids[i]);
  }

  // ---------------------------------------------------------------------------
  // Slicing.
  // ---------------------------------------------------------------------------

  // The index of the first measure whose number attribute is EXACTLY the given
  // string. Exact string matching, not numeric: MusicXML bar numbers are strings,
  // and "0" (a pickup) and "1a" (a split bar) are both real and both lost by a
  // parseInt. A repeated number resolves to its first occurrence, and because the
  // kept range is then taken by document POSITION between the two anchors, a
  // second bar carrying the same number inside the range is kept normally.
  function indexOfMeasure(measures, number) {
    for (let i = 0; i < measures.length; i++) {
      if (measures[i].getAttribute("number") === number) return i;
    }
    return -1;
  }

  // sliceDoc(doc, fromNumber, toNumber, inject) -> true if the document was
  // sliced in place, false if the range could not be resolved. PRIVATE: the
  // inject flag exists so the selfTest can drive the same path with the injector
  // switched off, which is the negative control that proves the injector is
  // load-bearing. No caller outside this file can reach it, so the flag cannot
  // become a way of producing a broken excerpt in production.
  //
  // Every part is validated BEFORE any measure is removed, so a range that one
  // part cannot express leaves the document untouched rather than half-cut.
  function sliceDoc(doc, fromNumber, toNumber, inject) {
    const parts = partsOf(doc);
    const plan = [];

    for (let p = 0; p < parts.length; p++) {
      const partEl = parts[p];
      const measures = measuresOf(partEl);
      const fromIndex = indexOfMeasure(measures, fromNumber);
      const toIndex = indexOfMeasure(measures, toNumber);
      const partLabel = partEl.getAttribute("id") || "(no id)";
      if (fromIndex === -1 || toIndex === -1) {
        logWarn(
          "MusicExcerpt: part " + partLabel + " has no bar '" +
            (fromIndex === -1 ? fromNumber : toNumber) + "'"
        );
        return false;
      }
      if (fromIndex > toIndex) {
        logWarn(
          "MusicExcerpt: bar '" + fromNumber + "' falls after bar '" + toNumber +
            "' in part " + partLabel + "; the range is empty"
        );
        return false;
      }
      plan.push({ partEl, measures, fromIndex, toIndex, partLabel });
    }

    for (let p = 0; p < plan.length; p++) {
      const step = plan[p];
      // The state is read from the WHOLE part, before anything is removed: the
      // declarations it needs are in the bars about to be dropped.
      const state = inject
        ? governingState(doc, step.partEl.getAttribute("id"), step.measures[step.fromIndex])
        : null;
      for (let m = 0; m < step.measures.length; m++) {
        if (m < step.fromIndex || m > step.toIndex) step.measures[m].remove();
      }
      if (inject && state) {
        const added = injectGoverning(step.measures[step.fromIndex], state);
        logDebug("MusicExcerpt: part " + step.partLabel + " re-declared", added);
      }
    }
    return true;
  }

  // sliceXml(xmlText, fromNumber, toNumber) -> a MusicXML string holding only the
  // bars from fromNumber to toNumber inclusive, with the state in force
  // re-declared on the first kept bar of every part; or null on any failure.
  // Never throws.
  //
  // The bar numbers are STRINGS, matched exactly against the measure number
  // attributes. A number argument is refused rather than coerced: coercion would
  // quietly turn a caller that thinks in integers into one that cannot address a
  // "0" pickup or a "1a", which is the very thing the string rule exists for.
  //
  // The header, defaults, credits and part-list are kept as they are: a credit
  // makes no difference to an excerpt render (measured: identical geometry with
  // and without, under header:"none"), so removing it would be surgery for
  // nothing.
  function sliceXml(xmlText, fromNumber, toNumber) {
    if (typeof fromNumber !== "string" || typeof toNumber !== "string") {
      logWarn("MusicExcerpt: bar numbers must be strings, matched exactly (e.g. \"9\", \"0\", \"1a\")");
      return null;
    }
    const doc = parseScore(xmlText);
    if (doc === null) return null;
    try {
      if (!sliceDoc(doc, fromNumber, toNumber, true)) return null;
      const out = new XMLSerializer().serializeToString(doc);
      logInfo("MusicExcerpt: sliced bars " + fromNumber + " to " + toNumber);
      return out;
    } catch (e) {
      logError("MusicExcerpt: slicing failed", e);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // selfTest — BROWSER-ONLY for every slicing row (needs DOMParser and
  // XMLSerializer). Fixtures are hand-built strings, not corpus files, so the
  // suite needs no fetch and no network: the two shapes are modelled on Satie
  // (one part, two staves, clefs 1 and 2) and Joplin (two parts, one staff each,
  // a mid-piece key change), which are the two cases the spike measured.
  // ---------------------------------------------------------------------------

  function selfTest() {
    const results = {
      hasSliceXml: typeof sliceXml === "function",
      hasGoverningState: typeof governingState === "function",
      hasSelfTest: typeof selfTest === "function",
      domParserPresent: domAvailable(),
    };

    // Without DOMParser the fixture rows cannot run at all; report what we know
    // and return early so the table stays clean rather than filling with rows
    // that pass vacuously because every call returned null.
    if (!results.domParserPresent) {
      if (typeof console !== "undefined" && typeof console.table === "function") {
        console.table(results);
      }
      logWarn("MusicExcerpt selfTest: no DOMParser (node?) — slicing rows skipped");
      return results;
    }

    // --- fixture builders --------------------------------------------------
    const note = "<note><pitch><step>C</step><octave>4</octave></pitch><duration>1</duration></note>";
    function measure(number, inner) {
      return '<measure number="' + number + '">' + (inner || "") + "</measure>";
    }
    function score(partListInner, partsInner) {
      return (
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<score-partwise version="3.1"><part-list>' + partListInner + "</part-list>" +
        partsInner + "</score-partwise>"
      );
    }
    function scorePart(id, name) {
      return '<score-part id="' + id + '"><part-name>' + name + "</part-name></score-part>";
    }
    function parse(xml) {
      return new DOMParser().parseFromString(xml, "application/xml");
    }
    // The tag names of one measure's opening <attributes>, in document order.
    function attributeTagsOf(measureEl) {
      const at = measureEl ? openingAttributesOf(measureEl) : null;
      if (!at) return [];
      const out = [];
      for (let i = 0; i < at.children.length; i++) out.push(at.children[i].tagName);
      return out;
    }
    function firstMeasureOfPart(doc, index) {
      const parts = partsOf(doc);
      const partEl = parts[index || 0];
      return partEl ? measuresOf(partEl)[0] : null;
    }
    function countClefs(measureEl) {
      return measureEl ? measureEl.getElementsByTagName("clef").length : -1;
    }

    // --- the Satie shape: one part, two staves, both clefs in bar 1 ---------
    const SATIE_BAR_1 =
      "<attributes><divisions>1</divisions>" +
      "<key><fifths>2</fifths><mode>major</mode></key>" +
      "<time><beats>3</beats><beat-type>4</beat-type></time>" +
      "<staves>2</staves>" +
      '<clef number="1"><sign>G</sign><line>2</line></clef>' +
      '<clef number="2"><sign>F</sign><line>4</line></clef>' +
      "</attributes>" + note;
    let satieParts = measure("1", SATIE_BAR_1);
    for (let n = 2; n <= 10; n++) satieParts += measure(String(n), note);
    const SATIE = score(scorePart("P1", "Piano"), "<part id=\"P1\">" + satieParts + "</part>");

    // Fixture canary: the shape must itself be well-formed and hold ten bars,
    // so a broken fixture reddens here rather than passing every row below for
    // the wrong reason.
    const satieDoc = parse(SATIE);
    results.satieFixtureWellFormed =
      satieDoc.getElementsByTagName("parsererror").length === 0 &&
      measuresOf(partsOf(satieDoc)[0]).length === 10;

    const satieSlice = sliceXml(SATIE, "9", "10");
    results.satieSliceReturnsString = typeof satieSlice === "string" && satieSlice.length > 0;
    const satieOut = satieSlice ? parse(satieSlice) : null;
    const satieFirst = satieOut ? firstMeasureOfPart(satieOut, 0) : null;
    const satieTags = attributeTagsOf(satieFirst);

    results.satieInjectsDivisions = satieTags.indexOf("divisions") !== -1;
    results.satieInjectsKey = satieTags.indexOf("key") !== -1;
    results.satieInjectsTime = satieTags.indexOf("time") !== -1;
    results.satieInjectsStaves = satieTags.indexOf("staves") !== -1;
    results.satieInjectsBothClefs = countClefs(satieFirst) === 2;
    // Both clefs, and the RIGHT ones on the RIGHT staves: a pair of treble clefs
    // would satisfy a bare count of two while being the exact defect measured on
    // Joplin, where an unclefed staff read as treble.
    results.satieClefsAreGandFbyStaff = (function () {
      if (!satieFirst) return false;
      const clefs = satieFirst.getElementsByTagName("clef");
      if (clefs.length !== 2) return false;
      const byStaff = {};
      for (let i = 0; i < clefs.length; i++) {
        const number = clefs[i].getAttribute("number") || DEFAULT_CLEF_STAFF;
        const sign = clefs[i].getElementsByTagName("sign")[0];
        byStaff[number] = sign ? sign.textContent : null;
      }
      return byStaff["1"] === "G" && byStaff["2"] === "F";
    })();
    // The key that travelled is the one in force, not merely any key element.
    results.satieInjectedKeyIsTwoSharps = (function () {
      if (!satieFirst) return false;
      const fifths = satieFirst.getElementsByTagName("fifths")[0];
      return !!fifths && fifths.textContent === "2";
    })();
    // Content order asserted on the injected bar.
    results.satieAttributeOrderCorrect =
      satieTags.join(",") === "divisions,key,time,staves,clef,clef";

    // --- the negative control ---------------------------------------------
    // The SAME input through the SAME slicing path with the injector off. It must
    // lack the clef entirely. Run as a two-sided pair with the row above: an
    // injector that had silently stopped working would leave both sides clefless,
    // and only the pair can tell that apart from a working one.
    const naiveDoc = parse(SATIE);
    const naiveSliced = sliceDoc(naiveDoc, "9", "10", false);
    const naiveFirst = naiveSliced ? firstMeasureOfPart(naiveDoc, 0) : null;
    results.naiveSliceSucceeds = naiveSliced === true;
    results.naiveSliceHasNoClef = countClefs(naiveFirst) === 0;
    results.naiveSliceHasNoAttributes = attributeTagsOf(naiveFirst).length === 0;
    results.injectorIsLoadBearing =
      results.satieInjectsBothClefs === true && results.naiveSliceHasNoClef === true;

    // --- the Joplin shape: two parts, one staff each, key change at bar 55 --
    const JOPLIN_P1_BAR_1 =
      "<attributes><divisions>4</divisions>" +
      "<key><fifths>0</fifths><mode>major</mode></key>" +
      "<time><beats>2</beats><beat-type>4</beat-type></time>" +
      "<clef><sign>G</sign><line>2</line></clef></attributes>" + note;
    const JOPLIN_P2_BAR_1 =
      "<attributes><divisions>4</divisions>" +
      "<key><fifths>0</fifths><mode>major</mode></key>" +
      "<time><beats>2</beats><beat-type>4</beat-type></time>" +
      "<clef><sign>F</sign><line>4</line></clef></attributes>" + note;
    const KEY_CHANGE = "<attributes><key><fifths>-1</fifths><mode>major</mode></key></attributes>" + note;
    function joplinPart(id, barOne) {
      return (
        '<part id="' + id + '">' +
        measure("1", barOne) + measure("2", note) +
        measure("55", KEY_CHANGE) + measure("56", note) + measure("57", note) +
        "</part>"
      );
    }
    const JOPLIN = score(
      scorePart("P1", "Right hand") + scorePart("P2", "Left hand"),
      joplinPart("P1", JOPLIN_P1_BAR_1) + joplinPart("P2", JOPLIN_P2_BAR_1)
    );

    // Starting exactly ON the change bar: its own key wins and is not overwritten.
    const onChange = sliceXml(JOPLIN, "55", "56");
    const onChangeDoc = onChange ? parse(onChange) : null;
    const onChangeFirst = onChangeDoc ? firstMeasureOfPart(onChangeDoc, 0) : null;
    const onChangeTags = attributeTagsOf(onChangeFirst);
    results.onChangeSliceReturnsString = typeof onChange === "string" && onChange.length > 0;
    results.onChangeKeepsOwnKey = (function () {
      if (!onChangeFirst) return false;
      const keys = onChangeFirst.getElementsByTagName("key");
      const fifths = onChangeFirst.getElementsByTagName("fifths");
      // Exactly ONE key, and it is the bar's own -1: two keys would mean the
      // governing key was injected beside the change rather than deferring to it.
      return keys.length === 1 && fifths.length === 1 && fifths[0].textContent === "-1";
    })();
    results.onChangeInjectsTheRest =
      onChangeTags.indexOf("divisions") !== -1 &&
      onChangeTags.indexOf("time") !== -1 &&
      onChangeTags.indexOf("clef") !== -1;
    results.onChangeAttributeOrderCorrect = onChangeTags.join(",") === "divisions,key,time,clef";

    // Starting AFTER the change: the changed key is walked back and injected.
    const afterChange = sliceXml(JOPLIN, "56", "57");
    const afterDoc = afterChange ? parse(afterChange) : null;
    const afterFirst = afterDoc ? firstMeasureOfPart(afterDoc, 0) : null;
    results.afterChangeSliceReturnsString = typeof afterChange === "string" && afterChange.length > 0;
    results.afterChangeInjectsChangedKey = (function () {
      if (!afterFirst) return false;
      const fifths = afterFirst.getElementsByTagName("fifths");
      return fifths.length === 1 && fifths[0].textContent === "-1";
    })();
    // The bar-1 key must NOT be what travelled: 0 here would mean the walk
    // stopped at the wrong declaration, which is the whole point of walking back.
    results.afterChangeDidNotUseOpeningKey =
      results.afterChangeInjectsChangedKey === true;

    // Multi-part: the walk runs per part, and each part gets ITS OWN clef.
    results.multiPartWalksIndependently = (function () {
      if (!afterDoc) return false;
      const parts = partsOf(afterDoc);
      if (parts.length !== 2) return false;
      const signOf = function (index) {
        const first = measuresOf(parts[index])[0];
        const sign = first ? first.getElementsByTagName("sign")[0] : null;
        return sign ? sign.textContent : null;
      };
      return signOf(0) === "G" && signOf(1) === "F";
    })();
    results.multiPartBothPartsSliced = (function () {
      if (!afterDoc) return false;
      const parts = partsOf(afterDoc);
      return parts.length === 2 && measuresOf(parts[0]).length === 2 && measuresOf(parts[1]).length === 2;
    })();

    // --- string matching ---------------------------------------------------
    const PICKUP = score(
      scorePart("P1", "Piano"),
      '<part id="P1">' +
        measure("0", "<attributes><divisions>1</divisions><clef><sign>G</sign><line>2</line></clef></attributes>" + note) +
        measure("1", note) + measure("1a", note) + measure("2", note) +
        "</part>"
    );
    const pickupSlice = sliceXml(PICKUP, "0", "1");
    const pickupDoc = pickupSlice ? parse(pickupSlice) : null;
    results.pickupZeroSliceable =
      !!pickupDoc && measuresOf(partsOf(pickupDoc)[0]).length === 2 &&
      measuresOf(partsOf(pickupDoc)[0])[0].getAttribute("number") === "0";
    const splitSlice = sliceXml(PICKUP, "1a", "2");
    const splitDoc = splitSlice ? parse(splitSlice) : null;
    results.splitBarOneASliceable =
      !!splitDoc && measuresOf(partsOf(splitDoc)[0]).length === 2 &&
      measuresOf(partsOf(splitDoc)[0])[0].getAttribute("number") === "1a";
    // "1a" must not be reachable as "1": exact matching, not a prefix or a parseInt.
    results.splitBarNotMatchedNumerically = (function () {
      const asOne = sliceXml(PICKUP, "1", "1");
      if (typeof asOne !== "string") return false;
      const d = parse(asOne);
      const ms = measuresOf(partsOf(d)[0]);
      return ms.length === 1 && ms[0].getAttribute("number") === "1";
    })();
    results.unknownBarReturnsNull = sliceXml(SATIE, "9", "99") === null;
    results.unknownFromBarReturnsNull = sliceXml(SATIE, "99", "10") === null;
    results.fromAfterToReturnsNull = sliceXml(SATIE, "10", "9") === null;
    results.numericArgumentsRefused = sliceXml(SATIE, 9, 10) === null;

    // --- a redeclaration inside the range survives untouched ---------------
    const REDECLARE = score(
      scorePart("P1", "Piano"),
      '<part id="P1">' +
        measure("1", "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
          "<time><beats>4</beats><beat-type>4</beat-type></time>" +
          "<clef><sign>G</sign><line>2</line></clef></attributes>" + note) +
        measure("2", note) +
        measure("3", "<attributes><divisions>8</divisions></attributes>" + note) +
        measure("4", note) +
        "</part>"
    );
    const redeclareSlice = sliceXml(REDECLARE, "2", "4");
    const redeclareDoc = redeclareSlice ? parse(redeclareSlice) : null;
    results.innerRedeclarationSurvives = (function () {
      if (!redeclareDoc) return false;
      const ms = measuresOf(partsOf(redeclareDoc)[0]);
      if (ms.length !== 3) return false;
      const barThree = ms[1];
      if (barThree.getAttribute("number") !== "3") return false;
      const divisions = barThree.getElementsByTagName("divisions");
      return divisions.length === 1 && divisions[0].textContent === "8";
    })();
    // And the FIRST kept bar took the divisions in force at that point (1), not
    // the later redeclaration (8) — a forward walk would have taken the wrong one.
    results.firstKeptBarTookDivisionsInForce = (function () {
      if (!redeclareDoc) return false;
      const first = firstMeasureOfPart(redeclareDoc, 0);
      const divisions = first ? first.getElementsByTagName("divisions") : [];
      return divisions.length === 1 && divisions[0].textContent === "1";
    })();

    // --- a bar whose ONLY attributes element is mid-bar ---------------------
    // The shape the first-child rule got wrong: bar 3 opens straight onto a note
    // and changes clef part way through, so it has no bar-start attributes for
    // the governing state to merge into. The state must arrive in a NEW leading
    // element, and the author's mid-bar change must be left exactly as written.
    const MIDBAR_ONLY = score(
      scorePart("P1", "Piano"),
      '<part id="P1">' +
        measure("1", "<attributes><divisions>1</divisions><key><fifths>3</fifths></key>" +
          "<time><beats>6</beats><beat-type>8</beat-type></time>" +
          "<clef><sign>G</sign><line>2</line></clef></attributes>" + note) +
        measure("2", note) +
        measure("3", note + "<attributes><clef><sign>F</sign><line>4</line></clef></attributes>" + note) +
        measure("4", note) +
        "</part>"
    );
    const midBarOnlySlice = sliceXml(MIDBAR_ONLY, "3", "4");
    const midBarOnlyFirst = midBarOnlySlice ? firstMeasureOfPart(parse(midBarOnlySlice), 0) : null;
    // The governing state arrives in a leading attributes element, BEFORE the
    // first note, carrying the clef in force rather than the mid-bar one.
    results.midBarOnlyGetsLeadingAttributes = (function () {
      if (!midBarOnlyFirst || midBarOnlyFirst.children.length === 0) return false;
      const lead = midBarOnlyFirst.children[0];
      if (lead.tagName !== "attributes") return false;
      const tags = [];
      for (let i = 0; i < lead.children.length; i++) tags.push(lead.children[i].tagName);
      const sign = lead.getElementsByTagName("sign")[0];
      return tags.join(",") === "divisions,key,time,clef" && !!sign && sign.textContent === "G";
    })();
    // The author's mid-bar change survives with ONLY its own child: nothing was
    // appended into it, and it is still the second attributes element in the bar.
    results.midBarOnlyLeavesMidBarUntouched = (function () {
      if (!midBarOnlyFirst) return false;
      const attrs = childrenNamed(midBarOnlyFirst, "attributes");
      if (attrs.length !== 2) return false;
      const later = attrs[1];
      const sign = later.getElementsByTagName("sign")[0];
      return later.children.length === 1 && later.children[0].tagName === "clef" &&
        !!sign && sign.textContent === "F";
    })();

    // --- governingState directly ------------------------------------------
    const stateDoc = parse(SATIE);
    const stateMeasure = measuresOf(partsOf(stateDoc)[0])[8]; // bar 9, zero-based
    const state = governingState(stateDoc, "P1", stateMeasure);
    results.governingStateReturnsState = !!state && typeof state === "object";
    results.governingStateFindsBothClefs =
      !!state && Object.keys(state.clefs).sort().join(",") === "1,2";
    results.governingStateFindsDivisions =
      !!state && !!state.divisions && state.divisions.textContent === "1";
    results.governingStateBadPartReturnsNull =
      governingState(stateDoc, "NOPE", stateMeasure) === null;
    results.governingStateForeignMeasureReturnsNull = (function () {
      const other = parse(SATIE);
      const foreign = measuresOf(partsOf(other)[0])[0];
      return governingState(stateDoc, "P1", foreign) === null;
    })();
    results.governingStateNoArgsReturnsNull = governingState(null, "P1", null) === null;

    // A transposing part: transpose is inherited state by the same argument as
    // clef, so it is carried too. Omitting it would change what the excerpt MEANS
    // for any consumer that reads sounding pitch, silently.
    const TRANSPOSING = score(
      scorePart("P1", "Clarinet"),
      '<part id="P1">' +
        measure("1", "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
          "<time><beats>4</beats><beat-type>4</beat-type></time>" +
          "<clef><sign>G</sign><line>2</line></clef>" +
          "<transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>" + note) +
        measure("2", note) + measure("3", note) +
        "</part>"
    );
    const transposingSlice = sliceXml(TRANSPOSING, "2", "3");
    const transposingDoc = transposingSlice ? parse(transposingSlice) : null;
    results.transposeCarried = (function () {
      if (!transposingDoc) return false;
      const first = firstMeasureOfPart(transposingDoc, 0);
      const chromatic = first ? first.getElementsByTagName("chromatic") : [];
      return chromatic.length === 1 && chromatic[0].textContent === "-2";
    })();
    results.transposeInAttributeOrder = (function () {
      if (!transposingDoc) return false;
      return attributeTagsOf(firstMeasureOfPart(transposingDoc, 0)).join(",") ===
        "divisions,key,time,clef,transpose";
    })();

    // --- directions are NOT injected, by decision --------------------------
    const WITH_DYNAMIC = score(
      scorePart("P1", "Piano"),
      '<part id="P1">' +
        measure("1", "<attributes><divisions>1</divisions><key><fifths>0</fifths></key>" +
          "<time><beats>4</beats><beat-type>4</beat-type></time>" +
          "<clef><sign>G</sign><line>2</line></clef></attributes>" +
          "<direction><direction-type><dynamics><pp/></dynamics></direction-type></direction>" +
          "<direction><direction-type><words>Lent</words></direction-type></direction>" + note) +
        measure("2", note) + measure("3", note) +
        "</part>"
    );
    const dynamicSlice = sliceXml(WITH_DYNAMIC, "2", "3");
    const dynamicDoc = dynamicSlice ? parse(dynamicSlice) : null;
    results.directionsNotInjected =
      !!dynamicDoc && dynamicDoc.getElementsByTagName("direction").length === 0;
    // The same fixture proves the attributes half DID travel, so the row above
    // cannot pass merely because the slice failed and produced nothing.
    results.directionsFixtureStillInjectsAttributes =
      !!dynamicDoc && countClefs(firstMeasureOfPart(dynamicDoc, 0)) === 1;

    // --- bad input ---------------------------------------------------------
    results.nullInputReturnsNull = sliceXml(null, "1", "2") === null;
    results.undefinedInputReturnsNull = sliceXml(undefined, "1", "2") === null;
    results.emptyStringReturnsNull = sliceXml("   ", "1", "2") === null;
    results.junkInputReturnsNull = sliceXml("not xml at all <<<", "1", "2") === null;
    results.nonScoreXmlReturnsNull = sliceXml("<foo><bar/></foo>", "1", "2") === null;
    results.timewiseRefused =
      sliceXml('<score-timewise><measure number="1"/></score-timewise>', "1", "1") === null;
    results.numberInputReturnsNull = sliceXml(42, "1", "2") === null;

    // --- the round trip ----------------------------------------------------
    results.roundTripMeasureCount = (function () {
      const out = sliceXml(SATIE, "3", "7");
      if (typeof out !== "string") return false;
      const d = parse(out);
      if (d.getElementsByTagName("parsererror").length > 0) return false;
      const ms = measuresOf(partsOf(d)[0]);
      return ms.length === 5;
    })();
    results.roundTripFirstBarNumber = (function () {
      const out = sliceXml(SATIE, "3", "7");
      if (typeof out !== "string") return false;
      const ms = measuresOf(partsOf(parse(out))[0]);
      return ms.length > 0 && ms[0].getAttribute("number") === "3";
    })();
    results.roundTripLastBarNumber = (function () {
      const out = sliceXml(SATIE, "3", "7");
      if (typeof out !== "string") return false;
      const ms = measuresOf(partsOf(parse(out))[0]);
      return ms.length > 0 && ms[ms.length - 1].getAttribute("number") === "7";
    })();
    results.roundTripKeepsPartList = (function () {
      const out = sliceXml(JOPLIN, "56", "57");
      if (typeof out !== "string") return false;
      const d = parse(out);
      return d.getElementsByTagName("score-part").length === 2;
    })();
    results.sourceNotMutated = (function () {
      // sliceXml parses its own copy, so the caller's string is untouched and a
      // second call on the same input gives the same answer.
      const once = sliceXml(SATIE, "9", "10");
      const twice = sliceXml(SATIE, "9", "10");
      return typeof once === "string" && once === twice;
    })();

    if (typeof console !== "undefined" && typeof console.table === "function") {
      console.table(results);
    }
    logInfo("MusicExcerpt selfTest verdict", results);
    return results;
  }

  return { sliceXml, governingState, selfTest };
})();

// Attach to globalThis (not window) deliberately, following MusicPdfMarkup: the
// module owns no page DOM and resolves DOMParser at call time, so it LOADS under
// node and its selfTest can report the dependency-absent early return there. In
// the browser globalThis IS window, so window.MusicExcerpt resolves unchanged.
globalThis.MusicExcerpt = MusicExcerpt;
