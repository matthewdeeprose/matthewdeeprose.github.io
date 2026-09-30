/**
 * Mermaid Export Utilities
 * Enhanced export functions for Mermaid diagrams with text wrapping fixes and consistent Verdana font
 */
window.MermaidExportUtils = (function () {
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

  // Current logging level - can be overridden by flags
  let currentLogLevel = DEFAULT_LOG_LEVEL;
  if (ENABLE_ALL_LOGGING) {
    currentLogLevel = LOG_LEVELS.DEBUG;
  } else if (DISABLE_ALL_LOGGING) {
    currentLogLevel = -1; // Disable all logging
  }

  // Helper functions to check if logging should occur
  function shouldLog(level) {
    return currentLogLevel >= level;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(message, ...args);
    }
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(message, ...args);
    }
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(message, ...args);
    }
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(message, ...args);
    }
  }

  // Configuration
  const config = {
    viewBoxPadding: 50, // Add some padding to the viewBox if needed
    pngScale: 3, // Base scale for PNG exports (increased from 2 to 3)
    ariaLiveRegionId: "sr-announcer",
    debugMode: true,
    font: '"trebuchet ms", verdana, arial, sans-serif', // Updated to match working mermaid-cli font
    minWidth: 700, // Minimum width for exports
    minHeight: 900, // Minimum height for exports
    maxCanvasPixels: 16777216, // 4096x4096 - browser canvas limit safety margin
  };

  const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

  /**
   * Fallback ground for an export whose host chain yields no opaque colour —
   * a diagram prepared while detached, for instance. Every diagram on a real
   * page terminates the walk long before this.
   */
  const FALLBACK_EXPORT_BACKGROUND = "white";

  /**
   * Paint properties copied from the live cascade onto the export clone, for
   * elements in the SVG namespace.
   *
   * `fill-opacity` and `stroke-dasharray` carry nothing on most types; they are
   * here so the pattern-fill and dashed-series work does not have to revisit
   * this list.
   */
  const INLINED_PAINT_PROPERTIES = Object.freeze([
    "fill",
    "stroke",
    "stroke-width",
    "fill-opacity",
    "stroke-dasharray",
  ]);

  /**
   * The same job for HTML inside a <foreignObject>, whose paint channel is
   * `color` and `background-color` rather than `fill` and `stroke`. A flowchart
   * label is HTML, not SVG text, so without this branch the largest diagram
   * type's text is not covered at all — measured 30 August 2026, see
   * inlineComputedPaint's note.
   */
  const INLINED_HTML_PAINT_PROPERTIES = Object.freeze([
    "color",
    "background-color",
  ]);

  /**
   * Elements the pass leaves alone: they carry no paint of their own, and
   * writing attributes onto them only bloats the file.
   */
  const PAINT_PASS_SKIPPED_TAGS = Object.freeze([
    "style",
    "script",
    "title",
    "desc",
    "metadata",
  ]);

  /**
   * Normalise a computed paint value into something valid as an SVG
   * presentation attribute in a STANDALONE file.
   *
   * Two differences between CSS computed values and SVG attribute syntax matter:
   * getComputedStyle returns a FuncIRI as `url("#id")` with quotes, which CSS
   * accepts and the SVG attribute grammar does not; and it returns lengths as
   * `2px`, where a bare number is the portable spelling. Both are handled here
   * rather than at the call site so the pattern work inherits it.
   *
   * @param {string} property - One of INLINED_PAINT_PROPERTIES
   * @param {string} value - The computed value
   * @returns {string} A value safe to write as an attribute
   */
  function normalisePaintValue(property, value) {
    let normalised = value;

    // url("#id") -> url(#id)
    if (normalised.includes("url(")) {
      normalised = normalised.replace(/url\((['"])(.*?)\1\)/g, "url($2)");
    }

    // 2px -> 2, for stroke-width and friends
    if (property === "stroke-width" && /^[\d.]+px$/.test(normalised)) {
      normalised = normalised.slice(0, -2);
    }

    // "5px, 5px" -> "5,5". getComputedStyle returns a dash array with a unit on
    // every entry; SVG 1.1's attribute grammar takes bare numbers, and the
    // unitless spelling is what a standalone file should carry. Measured 25
    // August 2026: without this the series dashes export as "5px, 5px".
    if (property === "stroke-dasharray" && normalised !== "none") {
      normalised = normalised.replace(/([\d.]+)px/g, "$1").replace(/,\s+/g, ",");
    }

    return normalised;
  }

  /**
   * The ground the export should be painted on, read from the LIVE page.
   *
   * WHY A WALK RATHER THAN A RECT. This used to read `rect.background`, which is
   * a chart element only an xychart draws, so every other diagram type fell to a
   * hard-coded `white`. In dark mode that discards the ground the in-SVG <style>
   * block chose its text colour for, and a saved gantt came out white-on-white:
   * 20 of 21 text elements failing, 14 of them at exactly 1:1, measured 30
   * August 2026.
   *
   * WHY THE HOST CHAIN IS UNIVERSAL. Every diagram, of every type, is rendered
   * into a `div.mermaid` that the site theme paints, inside a document whose
   * body the theme also paints. So walking up from the SVG and taking the first
   * OPAQUE background is a source that exists for all types by construction,
   * needs no knowledge of what the diagram drew, and answers the right question:
   * what is behind this diagram on the page it is being saved from. Measured the
   * same day: `div.mermaid` computes `rgb(249, 255, 244)` in light and
   * `rgb(46, 40, 42)` in dark, opaque in both, for gantt, xychart and flowchart
   * alike.
   *
   * A partly transparent layer is deliberately NOT composited. Nothing in this
   * codebase paints one, and a wrong composite is harder to notice than a
   * skipped one; the walk simply continues until something is fully opaque.
   *
   * @param {SVGElement} svgElement - The live, in-document diagram SVG
   * @returns {string} A CSS colour, never empty
   */
  function resolveExportBackground(svgElement) {
    let node = svgElement;

    while (node && node.nodeType === 1) {
      const background = window.getComputedStyle(node).backgroundColor;

      // Opaque is the only thing that settles the question. `transparent`,
      // `rgba(…, 0)` and the empty string all mean "keep looking".
      if (background && !/^rgba\(.*,\s*0\)$/.test(background) && background !== "transparent") {
        logDebug(
          `[Mermaid Export] Export ground ${background} from <${node.tagName.toLowerCase()}>`
        );
        return background;
      }

      node = node.parentNode;
    }

    logDebug(
      `[Mermaid Export] No opaque ground in the host chain - falling back to ${FALLBACK_EXPORT_BACKGROUND}`
    );
    return FALLBACK_EXPORT_BACKGROUND;
  }

  /**
   * Copy the RESOLVED paint of a diagram onto its export clone.
   *
   * WHY THIS EXISTS. `cloneNode(true)` carries attributes and does not carry the
   * cascade. So before this pass a saved file showed the ORIGINAL
   * presentation-attribute paint — measured 25 August 2026 on an xychart: the
   * on-page bar computed `rgb(30, 86, 160)` while the clone's fill attribute
   * still read `#ECECFF`. A user saw a correct chart and saved a wrong one, with
   * nothing to signal it.
   *
   * WHY IT IS NO LONGER SCOPED TO XYCHART. It was, on the assertion that every
   * other type takes its colour from the <style> block Mermaid writes INSIDE the
   * SVG, which cloneNode does carry. That assertion is true of most paint and
   * FALSE of anything resolved against the PAGE, which a standalone file has
   * none of. Two channels were measured falling through it on 30 August 2026:
   *
   *   - `stroke="currentColor"` on a gantt's 15 axis and grid lines, which
   *     resolves against the page's inherited `color` and lands on the UA
   *     default BLACK in the file — in both modes;
   *   - inherited `color` on a flowchart's `.edgeLabel`, HTML inside a
   *     <foreignObject>, which does the same, also in both modes.
   *
   * Neither is a type-specific bug, so neither gets a type-specific guard. The
   * pass writes what the page computes, for every type; where the in-SVG <style>
   * block already governs an SVG element the attribute it writes is the weakest
   * source in the cascade and changes nothing, which is why widening it is safe.
   *
   * AMENDED 1 September 2026. That last sentence is still true and is no longer
   * the whole story: being the weakest source is what makes widening safe AND
   * what made the pass silently incomplete wherever the renderer painted through
   * an INLINE STYLE, which `cloneNode(true)` carries. A third channel was
   * measured falling through, on quadrantChart — the six quadrant boundary
   * lines, whose correct ink reached the file as an attribute and lost to
   * Mermaid's own inline `style`. The narrow repair is in the SVG branch below,
   * with the two rejected alternatives and the measurements that rejected them.
   *
   * The computed values must be read from the ORIGINAL, which is in the
   * document; getComputedStyle on a detached clone returns empty strings.
   *
   * @param {SVGElement} originalSvg - The live, in-document diagram SVG
   * @param {SVGElement} clone - The detached clone being prepared for export
   * @returns {number} Count of elements whose paint was inlined
   */
  function inlineComputedPaint(originalSvg, clone) {
    const originals = originalSvg.querySelectorAll("*");
    const clones = clone.querySelectorAll("*");

    // A length mismatch means the two trees are not in step and pairing by index
    // would write one element's paint onto another. Refuse rather than corrupt.
    if (originals.length !== clones.length) {
      logError(
        `[Mermaid Export] Paint inlining ABORTED - original has ${originals.length} elements, clone has ${clones.length}. Export will carry the un-themed attribute paint.`
      );
      return 0;
    }

    let inlined = 0;

    originals.forEach((original, index) => {
      if (PAINT_PASS_SKIPPED_TAGS.includes(original.tagName.toLowerCase())) {
        return;
      }

      const computed = window.getComputedStyle(original);
      const target = clones[index];
      let touched = false;

      if (original.namespaceURI === SVG_NAMESPACE) {
        INLINED_PAINT_PROPERTIES.forEach((property) => {
          const value = computed.getPropertyValue(property);
          if (!value) return;

          target.setAttribute(property, normalisePaintValue(property, value));

          // AN ATTRIBUTE IS THE WEAKEST SOURCE IN THE CASCADE, AND
          // `cloneNode(true)` CARRIES THE ELEMENT'S OWN INLINE STYLE — so where
          // the renderer painted through `style` rather than through an
          // attribute, the value written above is present in the file and
          // INERT. Measured 1 September 2026 on a quadrant chart: the exported
          // border line carried `stroke="rgb(225, 232, 236)"` next to
          // `style="stroke: rgb(0, 0, 0)"`, and rendered black. The correct
          // paint was in the file and lost.
          //
          // The repair is narrow ON PURPOSE. Only where the clone ALREADY
          // carries an inline declaration for this property is the value also
          // written into the clone's own style at `important` priority, which
          // is the one priority an inline declaration cannot outrank.
          // Everywhere else nothing changes, so the pass keeps the property the
          // note above depends on — the attribute stays the weakest source and
          // the in-SVG <style> block goes on governing what it already governed.
          //
          // WHY NOT STRIP THE CONFLICTING DECLARATION INSTEAD, which was the
          // other candidate: because REMOVING A DECLARATION DOES NOT PROMOTE
          // YOUR ATTRIBUTE, IT PROMOTES WHATEVER WAS NEXT IN THE CASCADE — and
          // that is a rule rather than a gantt quirk. Measured on the same day
          // across three types: stripping took gantt from 71 of 71 carried to
          // 65, because Mermaid's own in-SVG class rules (`.task.done0`,
          // `.taskText0`) then won instead, repainting a done bar's fill from
          // its pattern to `rgb(211, 211, 211)` and its outline from white to
          // grey. Worse, it strips `applyGanttEncoding`'s own
          // `fill: … !important` label declarations and the exported task text
          // turns white on a pale bar. Quadrant and xychart were unaffected, so
          // a quadrant-only measurement would have chosen the wrong repair.
          //
          // WHY NOT WRITE EVERY PROPERTY AT `important`, the simplest form of
          // this fix: it also reaches 100% carried, but it emits 260 to 345
          // `!important` declarations per file where this emits 12 to 13, and
          // it makes the pass the STRONGEST source on every element rather than
          // the weakest — inverting the very property that made widening it
          // safe for all fifteen types.
          //
          // The STYLE takes the raw computed value and the ATTRIBUTE takes the
          // normalised one, because the two grammars differ: `url("#id")` and
          // `2px` are valid CSS and not valid as SVG attribute syntax. That
          // split already exists between this branch and the HTML branch below.
          if (target.style.getPropertyValue(property)) {
            target.style.setProperty(property, value, "important");
          }

          touched = true;
        });
      } else {
        // HTML inside a <foreignObject>. `fill` and `stroke` mean nothing here,
        // and a `color` ATTRIBUTE is not honoured on an HTML element either, so
        // these go on as an inline style. That is the strongest source, but the
        // value written is the one the cascade already produced, so it is
        // idempotent wherever the in-SVG <style> block was already deciding.
        INLINED_HTML_PAINT_PROPERTIES.forEach((property) => {
          const value = computed.getPropertyValue(property);
          if (!value) return;

          target.style.setProperty(property, value);
          touched = true;
        });
      }

      if (touched) inlined++;
    });

    logInfo(
      `[Mermaid Export] Inlined resolved paint onto ${inlined} of ${originals.length} elements`
    );
    return inlined;
  }

  /**
   * Selectors, classes and wording the static document export works with.
   * The disclosure's two classes are the SCORM builder's own long-description
   * convention (scorm-builder/enhancers/long-descriptions.js), not new names.
   */
  const STATIC_EXPORT = Object.freeze({
    diagramSvgSelector: ".mermaid-container .mermaid > svg",
    deadToolbarSelector:
      ".mermaid-controls, .mermaid-view-controls, .mermaid-pan-zoom-controls",
    descriptionSelector: ".mermaid-description",
    descriptionToolbarSelector: ".mermaid-description .mermaid-export-controls",
    disclosureClass: "long-description-details",
    disclosureBodyClass: "image-long-description",
    disclosureSummary: "Diagram description",
    fullscreenClass: "fullscreen-mode",
    panZoomContainerSelector: ".mermaid-pan-zoom-container",
  });

  /**
   * The ground each site mode paints behind a diagram (`div.mermaid`'s
   * computed background). Source: resolveExportBackground's note above,
   * measured 30 August 2026; read again by the Mermaid UI parcel 11a-3
   * grounding probe on a light and a dark page. The static export's second
   * copy of each diagram is painted against the OTHER mode's ground, which is
   * not on the page to be read, so it is written here.
   */
  const SITE_MODE_GROUNDS = Object.freeze({
    light: "rgb(249, 255, 244)",
    dark: "rgb(46, 40, 42)",
  });

  /** The two site modes, as the static export tags its copies with them. */
  const SITE_MODES = Object.freeze({ LIGHT: "light", DARK: "dark" });

  /**
   * F22 (Mermaid UI parcel 9d). The page draws a diagram no narrower than the
   * width that keeps its smallest text at 10 px (the SVG's inline min-width,
   * written by mermaid-controls.js), so its box scrolls where the column is
   * narrower. The export has no script to watch that, so each box is made a
   * named, focusable group AT EXPORT TIME wherever its floor is wider than
   * the narrowest column the document can be read in: 320 CSS px, the WCAG
   * 1.4.10 reflow width, Matthew's choice of 28 September 2026 (the brief's
   * 647 px, parcel 9c's column at 1366, left the sequence and timeline boxes
   * unreachable at 1280, where the column is 571 px). On a wide screen some
   * such boxes do not scroll; that is the accepted cost of a script-free rule.
   *
   * Parcel 9e, Matthew's two rulings of 28 September 2026 (item 94), decided
   * on the same rule, never a second one: (A) a stop whose container carries
   * the diagram's short description (data-svg-accessible-name, written by the
   * description engine) is an image named with exactly that description, and
   * its SVG copies leave the accessibility tree, so focus reads the
   * description once and nothing else; with no description it keeps the
   * group and label. (B) a visible note after each stop, hidden from screen
   * readers. The label, role and note text match mermaid-view-controls.js.
   */
  const EXPORT_SCROLL_BOX = Object.freeze({
    minColumnPx: 320,
    label: "Diagram, scrolls sideways",
    role: "group",
    namedRole: "img",
    noteClass: "mermaid-scroll-note",
    noteText: "Scroll sideways to see the whole diagram.",
  });

  /**
   * The attribute naming the site mode a diagram copy was painted for. The
   * export's head CSS (THEMED_EXPORT_HEAD) shows the copy whose mode matches
   * the exported page's own light/dark switch.
   */
  const EXPORT_MODE_ATTRIBUTE = "data-export-mode";

  /**
   * Root attributes the page adds to a diagram SVG after Mermaid renders it,
   * which a fresh render lacks (measured by the parcel 11a-3 grounding probe):
   * the accessible name, the caption reference and three size records. The
   * second copy carries them so it is named and sized as the page's own.
   */
  const COPIED_ROOT_ATTRIBUTES = Object.freeze([
    "aria-label",
    "aria-describedby",
    "data-original-width",
    "data-original-height",
    "data-aspect-ratio",
  ]);

  /**
   * ARIA attributes whose value is a list of ids. A second copy's renamed ids
   * are updated in these as well as in href and url(#…) references.
   */
  const ID_REFERENCE_ATTRIBUTES = Object.freeze([
    "aria-labelledby",
    "aria-describedby",
    "aria-controls",
    "aria-owns",
    "aria-flowto",
    "aria-details",
    "aria-activedescendant",
    "aria-errormessage",
  ]);

  /**
   * Head CSS for the themed static export: hide the diagram copy that does not
   * match the exported page's own light/dark switch (`data-theme` on <html>,
   * set by the SCORM builder's shell). With no `data-theme` at all, the light
   * copy shows. It reaches only copies carrying EXPORT_MODE_ATTRIBUTE. Passed
   * to the builder as `options.head`, which lands after the library CSS.
   *
   * Since Mermaid UI parcel 9d (F22) it also lets a diagram box scroll
   * sideways and releases any inline pixel height — the page releases it with
   * mermaid-controls.css's `height: auto !important`, and without this a
   * stored height held the exported diagram at that height, whatever its
   * width. A focused box needs no rule here: the builder's own
   * `.document-content [tabindex]:focus-visible` ring reaches it in both of
   * the shell's themes (measured, parcel 9d).
   *
   * Since parcel 9e it sizes the scroll note (EXPORT_SCROLL_BOX.noteClass),
   * and since parcel 9e-2 keeps it, inside the box, at the box's left edge
   * while the box scrolls, as mermaid-controls.css does on the page.
   * No colour: the note takes the shell's text colour, so its contrast is
   * the body text's in both of the shell's themes.
   */
  const THEMED_EXPORT_HEAD = `<style>
html[data-theme="dark"] .mermaid > svg[${EXPORT_MODE_ATTRIBUTE}="${SITE_MODES.LIGHT}"],
html:not([data-theme="dark"]) .mermaid > svg[${EXPORT_MODE_ATTRIBUTE}="${SITE_MODES.DARK}"] {
  display: none !important;
}
.mermaid {
  overflow-x: auto;
}
.mermaid > .mermaid-scroll-note {
  position: sticky;
  left: 0;
  margin: 0;
  padding: 0.25rem 0.5rem;
  font-size: 0.8em;
}
.mermaid > svg {
  height: auto !important;
}
</style>`;

  /**
   * Build a static copy of a rendered document for export (HTML or SCORM).
   *
   * Works on `root.cloneNode(true)` only and never writes to `root`: the page
   * a person is using must be exactly as it was after an export.
   *
   * 1. THE BELT. Each diagram's resolved paint is inlined onto its clone. Since
   *    the page-ink pass (Mermaid UI parcel 10) every diagram already carries
   *    its paint inline, so this should change nothing a reader sees; it is kept
   *    as a canary and a safety net for any paint channel that pass missed. The
   *    pairing is by index, so a length mismatch skips the belt entirely rather
   *    than write one diagram's paint onto another.
   *    THE GROUND, in the same pairing. Each diagram's inks were chosen against
   *    the ground behind it on the page, and the SVG itself is transparent, so
   *    in the export it would take whatever the shell paints: in the shell's
   *    dark theme a diagram from a light page read dark on dark (Mermaid UI
   *    F21). Each copy therefore carries that ground inline, found by the same
   *    host-chain walk the SVG download already uses (resolveExportBackground).
   * 2. THE THREE DIAGRAM TOOLBARS. Copy, download, width, full screen,
   *    orientation and theme all need the page's scripts, which the export does
   *    not carry. Leaving full screen hides the pan/zoom toolbar rather than
   *    removing it, so there are three toolbars to strip, not two.
   * 3. THE DESCRIPTION PANEL'S OWN TOOLBAR (Description export options). Its six
   *    buttons also need the page's scripts.
   * 4. THE DESCRIPTION PANEL. It ships hidden (inline `display: none`) and its
   *    only opener is the *Show diagram description* button stripped in step 2,
   *    so without this every description would be unreachable in the export.
   *    Each panel is wrapped in the builder's own documented disclosure, which
   *    opens without script and whose headings the builder keeps out of the
   *    contents list. Its id and classes are kept, because the figure's
   *    references read them; `aria-live` goes, as nothing updates it there.
   * 5. VIEW-STATE RESIDUE. Full-screen class, the pan/zoom wrapper and the
   *    SVG's inline transform are removed. The SVG's width and height are the
   *    size a person chose and are left alone.
   * 6. THE SCROLL BOX (parcel 9d, F22). Each box whose diagram's floor width
   *    exceeds EXPORT_SCROLL_BOX.minColumnPx is made a named, focusable stop,
   *    and every other box is left without those attributes, whatever the
   *    live page's box carried at that moment. Since parcel 9e the stop is
   *    named with the diagram's short description with its SVG hidden, and
   *    carries the scroll note; notes the page carried are not kept.
   *
   * A failed render carries no toolbar, so it needs no special case.
   *
   * @param {HTMLElement} root - The live, rendered document (e.g. `#output`)
   * @returns {string} The cleaned copy's inner HTML
   */
  /**
   * Make an exported diagram box a named, focusable stop when its diagram's
   * floor width (the live SVG's inline min-width) is wider than the narrowest
   * column the export can be read in; otherwise leave it with none of the
   * three attributes. See EXPORT_SCROLL_BOX.
   *
   * Parcel 9e: a stop whose container carries the cached short description
   * is an image named with it, its SVG hidden (ruling A); the second copy,
   * added later by prepareThemedStaticExport, follows this copy's
   * aria-hidden. Each stop gets one scroll note (ruling B) — since parcel
   * 9e-2 inside the box as its last child, as on the page — and any note
   * carried from the page is dropped, so the export's own rule is the only
   * one that decides. Runs once per box, on the primary copy.
   * @param {SVGSVGElement} liveSvg - The diagram on the page
   * @param {HTMLElement} cloneBox - The copy's .mermaid
   */
  function markExportScrollBox(liveSvg, cloneBox) {
    if (!cloneBox) return;
    const floorPx = parseFloat(liveSvg.style.minWidth);
    const isStop = floorPx > EXPORT_SCROLL_BOX.minColumnPx;
    const container = cloneBox.closest(".mermaid-container");
    const cachedName =
      isStop && container
        ? container.getAttribute("data-svg-accessible-name") || ""
        : "";
    const named = cachedName.trim() !== "";

    if (isStop) {
      cloneBox.setAttribute("tabindex", "0");
      cloneBox.setAttribute(
        "role",
        named ? EXPORT_SCROLL_BOX.namedRole : EXPORT_SCROLL_BOX.role
      );
      cloneBox.setAttribute(
        "aria-label",
        named ? cachedName : EXPORT_SCROLL_BOX.label
      );
    } else {
      cloneBox.removeAttribute("tabindex");
      cloneBox.removeAttribute("role");
      cloneBox.removeAttribute("aria-label");
    }

    // (A) The named stop is the diagram's one reading; its SVG leaves the tree.
    cloneBox.querySelectorAll(":scope > svg").forEach((svg) => {
      if (named) svg.setAttribute("aria-hidden", "true");
      else svg.removeAttribute("aria-hidden");
    });

    // (B) The note, decided here and never carried from the page: any note in
    // the container goes (since parcel 9e-2 the page's sits inside the box),
    // and a stop gets one as the box's last child. The second copy, added
    // later with after() on this one, lands between the two, so the note
    // stays last.
    const host = container || cloneBox.parentElement;
    if (host) {
      host
        .querySelectorAll(`.${EXPORT_SCROLL_BOX.noteClass}`)
        .forEach((note) => note.remove());
    }
    if (isStop) {
      const note = document.createElement("p");
      note.className = EXPORT_SCROLL_BOX.noteClass;
      note.setAttribute("aria-hidden", "true");
      note.textContent = EXPORT_SCROLL_BOX.noteText;
      cloneBox.append(note);
    }
  }

  function prepareStaticExport(root) {
    if (!root) return "";
    const clone = root.cloneNode(true);

    // 1. The belt: computed style must be read from the LIVE SVG.
    const liveSvgs = root.querySelectorAll(STATIC_EXPORT.diagramSvgSelector);
    const cloneSvgs = clone.querySelectorAll(STATIC_EXPORT.diagramSvgSelector);
    if (liveSvgs.length === cloneSvgs.length) {
      liveSvgs.forEach((live, index) => {
        inlineComputedPaint(live, cloneSvgs[index]);
        cloneSvgs[index].style.backgroundColor = resolveExportBackground(live);
        // 6. The scroll box, from the floor the page wrote on the live SVG.
        markExportScrollBox(live, cloneSvgs[index].parentElement);
      });
    } else {
      logWarn(
        `[Mermaid Export] Static export: ${liveSvgs.length} live diagrams against ${cloneSvgs.length} in the copy - paint belt and ground skipped for the whole export`
      );
    }

    // 2. The three diagram toolbars.
    clone
      .querySelectorAll(STATIC_EXPORT.deadToolbarSelector)
      .forEach((node) => node.remove());

    // 3. The description panel's own toolbar.
    clone
      .querySelectorAll(STATIC_EXPORT.descriptionToolbarSelector)
      .forEach((node) => node.remove());

    // 4. Each description panel into the builder's disclosure.
    clone
      .querySelectorAll(STATIC_EXPORT.descriptionSelector)
      .forEach((panel) => {
        panel.style.removeProperty("display");
        if (!panel.getAttribute("style")) panel.removeAttribute("style");
        panel.removeAttribute("aria-live");
        panel.classList.add(STATIC_EXPORT.disclosureBodyClass);

        const details = document.createElement("details");
        details.className = STATIC_EXPORT.disclosureClass;
        const summary = document.createElement("summary");
        summary.textContent = STATIC_EXPORT.disclosureSummary;

        panel.parentNode.insertBefore(details, panel);
        details.appendChild(summary);
        details.appendChild(panel);
      });

    // 5. View-state residue.
    clone
      .querySelectorAll(`.${STATIC_EXPORT.fullscreenClass}`)
      .forEach((node) => node.classList.remove(STATIC_EXPORT.fullscreenClass));
    clone
      .querySelectorAll(STATIC_EXPORT.panZoomContainerSelector)
      .forEach((wrapper) => {
        while (wrapper.firstChild) {
          wrapper.parentNode.insertBefore(wrapper.firstChild, wrapper);
        }
        wrapper.remove();
      });
    clone
      .querySelectorAll(STATIC_EXPORT.diagramSvgSelector)
      .forEach((svg) => {
        svg.style.removeProperty("transform");
        svg.style.removeProperty("transform-origin");
      });

    return clone.innerHTML;
  }

  /**
   * Give a detached diagram copy ids that cannot collide with the page's.
   *
   * WHY. Mermaid prefixes only SOME ids with the render id; the rest are bare
   * (`arrowhead`, `computer` on a sequence diagram, `L_A_B_0` on flowchart
   * edges, `node-0`, `todo`…), and several are referenced (`url(#…)`,
   * `href="#…"`). Measured by the parcel 11a-3 grounding probe: a second copy
   * clashed with the document's ids on 11 of 13 diagram types. A hidden copy
   * earlier in the document could then take a visible copy's markers or
   * symbols. So every id that does not already start with this copy's own
   * render id is renamed, and every reference to it inside the copy follows:
   * href / xlink:href, url(#…) in any attribute, the ARIA id-reference
   * attributes, and the copy's own <style> — url(#…) in its declarations and
   * #id in its SELECTORS only (Mermaid's sequence styles select `#arrowhead`;
   * a declaration's `#abc` may be a colour, so declarations are left alone).
   *
   * The root keeps its id: Mermaid's in-SVG <style> is scoped by it, and the
   * render id is already unique.
   *
   * @param {SVGElement} svg - The detached copy
   * @param {string} renderId - The id the copy was rendered with
   * @returns {number} Count of ids renamed
   */
  function renameCopyIds(svg, renderId) {
    const renamed = new Map();
    svg.querySelectorAll("[id]").forEach((element) => {
      const id = element.getAttribute("id");
      if (!id || id.startsWith(renderId)) return;
      const fresh = `${renderId}--${id}`;
      renamed.set(id, fresh);
      element.setAttribute("id", fresh);
    });
    if (!renamed.size) return 0;

    const renameUrls = (text) =>
      text.replace(
        /url\(\s*(['"]?)#([^'")\s]+)\1\s*\)/g,
        (match, quote, id) =>
          renamed.has(id) ? `url(${quote}#${renamed.get(id)}${quote})` : match
      );

    [svg, ...svg.querySelectorAll("*")].forEach((element) => {
      Array.from(element.attributes).forEach((attribute) => {
        let value = attribute.value;
        if (attribute.localName === "href" && value.startsWith("#")) {
          const id = value.slice(1);
          if (renamed.has(id)) value = `#${renamed.get(id)}`;
        } else if (ID_REFERENCE_ATTRIBUTES.includes(attribute.name)) {
          value = value
            .split(/\s+/)
            .map((id) => (renamed.has(id) ? renamed.get(id) : id))
            .join(" ");
        } else if (value.includes("url(")) {
          value = renameUrls(value);
        }
        if (value !== attribute.value) {
          element.setAttributeNS(attribute.namespaceURI, attribute.name, value);
        }
      });

      if (element.localName === "style") {
        // Selectors are the text between a closing brace (or the start) and
        // the next opening brace; only there is `#name` an id.
        element.textContent = renameUrls(
          element.textContent.replace(
            /(^|})([^{}]*)(?={)/g,
            (match, brace, selector) =>
              brace +
              selector.replace(/#(-?[_a-zA-Z][\w-]*)/g, (hit, id) =>
                renamed.has(id) ? `#${renamed.get(id)}` : hit
              )
          )
        );
      }
    });

    return renamed.size;
  }

  /**
   * Render one live diagram a second time, painted for the other site mode,
   * and return a detached copy ready for the static export — or null, after
   * logging, if anything fails. Never throws.
   *
   * Grounded by the parcel 11a-3 probe, which found 0 differing elements on
   * all 13 diagram types against a page loaded in that mode: the theme's
   * counterpart built into the source, rendered off the page into a host
   * carrying that mode's ground and the live diagram's width, the page's own
   * after-render paint run there (it reads the ground from the DOM, never the
   * site mode), then the belt and the ground while the copy can still compute
   * style. The host goes on `document.body`, never inside the rendered
   * document, and is removed in `finally`, so the page is left as it was.
   *
   * @param {SVGElement} liveSvg - The diagram SVG on the page
   * @param {string} mode - The site mode to paint for (SITE_MODES)
   * @param {string} renderId - A unique id for the render
   * @returns {Promise<SVGElement|null>} The copy, or null
   */
  async function renderSecondCopy(liveSvg, mode, renderId) {
    const themes = window.MermaidThemes;
    const container = liveSvg.closest(".mermaid-container");
    const mermaidDiv = liveSvg.parentNode;
    let host = null;

    try {
      const encoded = container && container.getAttribute("data-diagram-code");
      const select =
        container && container.querySelector(".mermaid-theme-select");
      if (!encoded || !select || !select.value) {
        logWarn(
          `[Mermaid Export] ${renderId}: no diagram source or applied theme - primary copy only`
        );
        return null;
      }
      const themeId = themes.getCounterpartTheme(select.value, mode);
      const source = themes.buildThemedSource(
        decodeURIComponent(encoded),
        themeId
      );
      if (source === null) {
        logWarn(
          `[Mermaid Export] ${renderId}: unknown theme "${themeId}" - primary copy only`
        );
        return null;
      }

      host = document.createElement("div");
      host.setAttribute("aria-hidden", "true");
      host.style.position = "absolute";
      host.style.left = "-20000px";
      host.style.top = "0";
      host.style.width = `${mermaidDiv.clientWidth}px`;
      host.style.backgroundColor = SITE_MODE_GROUNDS[mode];
      document.body.appendChild(host);

      const result = await window.mermaid.render(renderId, source);
      host.innerHTML = result.svg;
      const rendered = host.querySelector("svg");
      if (!rendered) throw new Error("the render returned no SVG");

      // The size the page gave the diagram, and the attributes the page adds.
      const liveStyle = liveSvg.getAttribute("style");
      if (liveStyle !== null) rendered.setAttribute("style", liveStyle);
      COPIED_ROOT_ATTRIBUTES.forEach((name) => {
        const value = liveSvg.getAttribute(name);
        if (value !== null) rendered.setAttribute(name, value);
      });

      // The page's own after-render paint, against this host's ground.
      themes.applySeriesEncoding(host);

      // The belt and the ground, read while the copy is still in the host.
      const copy = rendered.cloneNode(true);
      inlineComputedPaint(rendered, copy);
      copy.style.backgroundColor = resolveExportBackground(rendered);

      renameCopyIds(copy, renderId);
      copy.setAttribute(EXPORT_MODE_ATTRIBUTE, mode);
      logDebug(
        `[Mermaid Export] ${renderId}: ${mode} copy painted with "${themeId}"`
      );
      return copy;
    } catch (error) {
      logError(
        `[Mermaid Export] ${renderId}: second copy failed - primary copy only`,
        error
      );
      return null;
    } finally {
      if (host) host.remove();
    }
  }

  /**
   * The static export (prepareStaticExport, unchanged), with each diagram
   * carrying a second copy painted for the other site mode, so the exported
   * page's own light/dark switch can show the matching one (Mermaid UI
   * parcel 11a-3; THEMED_EXPORT_HEAD does the showing, with no script).
   *
   * The primary copy, the page's own, stays first in each `.mermaid`, and the
   * second copy is its next sibling. Diagrams are rendered ONE AT A TIME and
   * in order, because each copy's belt reads computed style and must run
   * before the next host appears. A diagram whose second copy fails ships
   * with its primary only, untagged, so the head CSS never hides it; the
   * export itself never fails for it.
   *
   * The static copy is re-parsed into an inert <template>, so nothing in it
   * loads or runs, and paired with the live diagrams by index, as the belt is.
   *
   * @param {HTMLElement} root - The live, rendered document (e.g. `#output`)
   * @returns {Promise<string>} The cleaned copy's inner HTML
   */
  async function prepareThemedStaticExport(root) {
    const html = prepareStaticExport(root);
    const themes = window.MermaidThemes;
    if (
      !root ||
      !html ||
      !window.mermaid ||
      typeof window.mermaid.render !== "function" ||
      !themes ||
      typeof themes.buildThemedSource !== "function" ||
      typeof themes.getCounterpartTheme !== "function"
    ) {
      return html;
    }

    const primaryMode = themes.utils.isDarkThemeActive()
      ? SITE_MODES.DARK
      : SITE_MODES.LIGHT;
    const secondMode =
      primaryMode === SITE_MODES.DARK ? SITE_MODES.LIGHT : SITE_MODES.DARK;

    const template = document.createElement("template");
    template.innerHTML = html;
    const liveSvgs = root.querySelectorAll(STATIC_EXPORT.diagramSvgSelector);
    const copySvgs = template.content.querySelectorAll(
      STATIC_EXPORT.diagramSvgSelector
    );
    if (liveSvgs.length !== copySvgs.length) {
      logWarn(
        `[Mermaid Export] Themed export: ${liveSvgs.length} live diagrams against ${copySvgs.length} in the copy - second copies skipped for the whole export`
      );
      return html;
    }

    const token = Math.random().toString(36).slice(2, 8);
    let added = 0;
    for (let index = 0; index < liveSvgs.length; index++) {
      const second = await renderSecondCopy(
        liveSvgs[index],
        secondMode,
        `mermaid-export-${secondMode}-${token}-${index}`
      );
      if (!second) continue;
      copySvgs[index].setAttribute(EXPORT_MODE_ATTRIBUTE, primaryMode);
      // Parcel 9e: inside a named stop both copies leave the tree.
      if (copySvgs[index].getAttribute("aria-hidden") === "true") {
        second.setAttribute("aria-hidden", "true");
      }
      copySvgs[index].after(second);
      added++;
    }

    logInfo(
      `[Mermaid Export] Themed export: ${added} of ${liveSvgs.length} diagrams carry a ${secondMode} copy`
    );
    return template.innerHTML;
  }

  /**
   * Fix text wrapping in SVG elements and apply consistent font
   * @param {SVGElement} svgElement - The SVG element to prepare
   * @returns {SVGElement} Prepared SVG clone with fixed text wrapping and font
   */
  function prepareSvgForExport(svgElement) {
    if (!svgElement) {
      logError(
        "[Mermaid Export] No SVG element provided for export preparation"
      );
      return null;
    }

    logInfo("[Mermaid Export] Starting SVG preparation for export");

    // Create a clone to avoid modifying the displayed SVG
    const clone = svgElement.cloneNode(true);

    // A diagram in a named scroll box is hidden on the page, because the box
    // speaks for it (parcel 9e). The saved file is the diagram on its own.
    clone.removeAttribute("aria-hidden");

    // Carry the resolved cascade onto the clone before anything else touches it,
    // so the saved file matches the screen. Runs for every diagram type.
    inlineComputedPaint(svgElement, clone);

    // Background, from the diagram's own host chain rather than from anything
    // the diagram happened to draw. The previous form read `rect.background`,
    // which only an xychart has, and fell to a hard-coded `white` for every
    // other type - so a dark-mode gantt was saved as white text on white.
    // See resolveExportBackground for why the host chain is the universal
    // source and what was measured to establish it.
    clone.style.backgroundColor = resolveExportBackground(svgElement);

    // Apply font family to SVG root
    clone.style.fontFamily = config.font;
    logDebug(`[Mermaid Export] Applied font family: ${config.font}`);

    // Get the original viewBox and dimensions
    const originalViewBox = svgElement.getAttribute("viewBox");
    const originalWidth =
      svgElement.width?.baseVal?.value ||
      svgElement.getBoundingClientRect().width;
    const originalHeight =
      svgElement.height?.baseVal?.value ||
      svgElement.getBoundingClientRect().height;

    // Store original dimensions for debugging
    if (config.debugMode) {
      logDebug(
        `[Mermaid Export] Original dimensions: ${originalWidth}x${originalHeight}`
      );
      logDebug(`[Mermaid Export] Original viewBox: ${originalViewBox}`);
    }

    // Size the file from the diagram's own viewBox plus the padding added
    // below, so the box and the padded viewBox share one shape and
    // preserveAspectRatio has nothing to letterbox (F18). The on-screen size,
    // raised to the minimums, is kept only for an SVG with no usable viewBox.
    const originalViewBoxValues = (originalViewBox || "")
      .split(" ")
      .map(parseFloat);
    const hasUsableViewBox =
      originalViewBoxValues.length === 4 &&
      originalViewBoxValues[2] > 0 &&
      originalViewBoxValues[3] > 0;
    const width = hasUsableViewBox
      ? originalViewBoxValues[2] + config.viewBoxPadding * 2
      : Math.max(originalWidth, config.minWidth);
    const height = hasUsableViewBox
      ? originalViewBoxValues[3] + config.viewBoxPadding * 2
      : Math.max(originalHeight, config.minHeight);

    // Set proper dimensions on the clone
    clone.setAttribute("width", width);
    clone.setAttribute("height", height);

    // Process the viewBox
    if (originalViewBox) {
      const viewBoxValues = originalViewBox.split(" ").map(parseFloat);
      if (viewBoxValues.length === 4) {
        // Add padding to the viewBox to ensure text isn't cut off
        const paddedViewBox = [
          viewBoxValues[0] - config.viewBoxPadding,
          viewBoxValues[1] - config.viewBoxPadding,
          viewBoxValues[2] + config.viewBoxPadding * 2,
          viewBoxValues[3] + config.viewBoxPadding * 2,
        ].join(" ");

        // Set the padded viewBox
        clone.setAttribute("viewBox", paddedViewBox);

        if (config.debugMode) {
          logDebug(`[Mermaid Export] Padded viewBox: ${paddedViewBox}`);
        }
      }
    }

    // Fix foreignObject div text wrapping issues - MAIN FIX
    const foreignObjectDivs = clone.querySelectorAll("foreignObject div");
    logDebug(
      `[Mermaid Export] Found ${foreignObjectDivs.length} foreignObject divs to process`
    );

    foreignObjectDivs.forEach((div, index) => {
      logDebug(
        `[Mermaid Export] Processing foreignObject div ${index + 1}/${
          foreignObjectDivs.length
        }`
      );
      logDebug(`[Mermaid Export] Original div styles:`, {
        whiteSpace: div.style.whiteSpace,
        display: div.style.display,
        width: div.style.width,
        overflow: div.style.overflow,
      });

      // Apply critical text wrapping fixes based on working mermaid-cli exports
      div.style.whiteSpace = "break-spaces"; // Changed from "normal" to "break-spaces"
      div.style.display = "table"; // Changed from "block" to "table"
      div.style.overflow = "visible";
      div.style.fontFamily = config.font;

      // Get the foreignObject parent to determine width
      const foreignObject = div.closest("foreignObject");
      if (foreignObject) {
        const foreignObjectWidth = foreignObject.getAttribute("width");
        if (foreignObjectWidth) {
          const availableWidth = parseInt(foreignObjectWidth);
          // Use full width instead of reducing by 10px - this was causing text overflow
          div.style.width = `${availableWidth}px`;
          logDebug(
            `[Mermaid Export] Set div width to full foreignObject width: ${availableWidth}px`
          );
        } else {
          logWarn(
            `[Mermaid Export] ForeignObject ${index + 1} has no width attribute`
          );
        }
      } else {
        logWarn(
          `[Mermaid Export] Div ${index + 1} has no foreignObject parent`
        );
      }

      logDebug(`[Mermaid Export] Updated div styles:`, {
        whiteSpace: div.style.whiteSpace,
        display: div.style.display,
        width: div.style.width,
        overflow: div.style.overflow,
        fontFamily: div.style.fontFamily,
      });
    });

    // Fix edge label text wrapping
    const edgeLabels = clone.querySelectorAll(".edgeLabel div");
    logDebug(
      `[Mermaid Export] Found ${edgeLabels.length} edge label divs to process`
    );

    edgeLabels.forEach((div, index) => {
      logDebug(
        `[Mermaid Export] Processing edge label div ${index + 1}/${
          edgeLabels.length
        }`
      );
      div.style.whiteSpace = "break-spaces"; // Changed from "normal" to "break-spaces"
      div.style.display = "table"; // Changed from "block" to "table"
      div.style.fontFamily = config.font;
    });

    // Apply styles to all text elements
    const textElements = clone.querySelectorAll("text, tspan");
    logDebug(
      `[Mermaid Export] Found ${textElements.length} text elements to process`
    );

    textElements.forEach((el) => {
      el.style.fontFamily = config.font;
      el.setAttribute("font-family", config.font);
    });

    // Add a comprehensive style element with improved text handling
    const styleElement = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "style"
    );
    styleElement.textContent = `
        /* Global font selector */
        * {
          font-family: ${config.font} !important;
        }
        
        /* Font styles */
        svg, text, tspan, div, span, foreignObject, p, .nodeLabel {
          font-family: ${config.font} !important;
        }
        
        /* Text element styles with improved wrapping */
        .nodeLabel div, foreignObject div {
          white-space: break-spaces !important; 
          display: table !important;
          overflow: visible !important;
          font-family: ${config.font} !important;
          line-height: 1.5 !important;
          text-align: center !important;
        }
        
        /* Edge label styles with improved wrapping */
        .edgeLabel div {
          white-space: break-spaces !important;
          display: table !important;
          font-family: ${config.font} !important;
          line-height: 1.5 !important;
          text-align: center !important;
        }

        /* Ensure foreignObject elements don't clip text */
        foreignObject {
          overflow: visible !important;
        }
      `;
    clone.insertBefore(styleElement, clone.firstChild);
    logDebug("[Mermaid Export] Added comprehensive style element");

    // Fix any existing style elements by overriding critical properties
    const existingStyles = clone.querySelectorAll("style");
    logDebug(
      `[Mermaid Export] Found ${existingStyles.length} existing style elements`
    );

    existingStyles.forEach((style, index) => {
      if (style !== styleElement) {
        logDebug(
          `[Mermaid Export] Updating existing style element ${index + 1}`
        );
        style.textContent += `
            /* Override problematic styles for text wrapping */
            div { 
              white-space: break-spaces !important; 
              display: table !important;
            }
            .labelBkg div, .edgeLabel div, foreignObject div, .nodeLabel div {
              white-space: break-spaces !important;
              display: table !important;
              overflow: visible !important;
              line-height: 1.5 !important;
            }
          `;
      }
    });

    // Set preserveAspectRatio attribute
    clone.setAttribute("preserveAspectRatio", "xMidYMid meet");

    logInfo(
      "[Mermaid Export] Prepared SVG with enhanced text wrapping and font fixes"
    );

    // Debug: Log some key measurements
    if (config.debugMode) {
      const finalForeignObjects = clone.querySelectorAll("foreignObject");
      logDebug(
        `[Mermaid Export] Final foreignObject count: ${finalForeignObjects.length}`
      );
      finalForeignObjects.forEach((fo, index) => {
        const width = fo.getAttribute("width");
        const height = fo.getAttribute("height");
        const childDiv = fo.querySelector("div");
        logDebug(
          `[Mermaid Export] ForeignObject ${
            index + 1
          }: width=${width}, height=${height}, div width=${
            childDiv?.style.width
          }`
        );
      });
    }

    return clone;
  }

  /**
   * Export diagram as SVG
   * @param {HTMLElement} container - The Mermaid container element
   * @param {string|number} id - Unique identifier for the filename
   */
  function exportAsSvg(container, id) {
    try {
      logInfo(`[Mermaid Export] Starting SVG export for diagram ${id}`);

      // Find the SVG element, specifically looking inside the .mermaid div
      const mermaidDiv = container.querySelector(".mermaid");
      const svgElement = mermaidDiv ? mermaidDiv.querySelector("svg") : null;

      if (!svgElement) {
        logError("[Mermaid Export] No diagram SVG found for export");
        announceToScreenReader("Failed to find diagram for SVG export");
        return;
      }

      logDebug("[Mermaid Export] Found SVG element, preparing for export");

      // Fix text wrapping and apply fonts to the SVG
      const preparedSvg = prepareSvgForExport(svgElement);

      if (!preparedSvg) {
        logError("[Mermaid Export] Failed to prepare SVG for export");
        announceToScreenReader("Failed to prepare SVG for export");
        return;
      }

      logInfo("[Mermaid Export] SVG prepared successfully, serialising");

      // Serialise the SVG to a string
      const svgData = new XMLSerializer().serializeToString(preparedSvg);

      logDebug(
        `[Mermaid Export] Serialised SVG length: ${svgData.length} characters`
      );

      // Create a blob with the SVG data
      const svgBlob = new Blob(
        ['<?xml version="1.0" standalone="no"?>\r\n', svgData],
        {
          type: "image/svg+xml;charset=utf-8",
        }
      );

      // Create download link
      const url = URL.createObjectURL(svgBlob);
      const downloadLink = document.createElement("a");
      downloadLink.href = url;
      downloadLink.download = `diagram-${id}.svg`;

      // Trigger download
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up
      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 100);

      logInfo(
        `[Mermaid Export] SVG export completed successfully for diagram ${id}`
      );
      // Announce to screen readers
      announceToScreenReader("SVG downloaded successfully");
    } catch (error) {
      logError("[Mermaid Export] Error exporting SVG:", error);
      announceToScreenReader("Failed to download SVG");
    }
  }

  /**
   * Export diagram as PNG
   * @param {HTMLElement} container - The Mermaid container element
   * @param {string|number} id - Unique identifier for the filename
   */
  function exportAsPng(container, id) {
    try {
      logInfo(`[Mermaid Export] Starting PNG export for diagram ${id}`);

      // Find the SVG element, specifically looking inside the .mermaid div
      const mermaidDiv = container.querySelector(".mermaid");
      const svgElement = mermaidDiv ? mermaidDiv.querySelector("svg") : null;

      if (!svgElement) {
        logError("[Mermaid Export] No diagram SVG found for export");
        announceToScreenReader("Failed to find diagram for PNG export");
        return;
      }

      logDebug("[Mermaid Export] Found SVG element, preparing for PNG export");

      // Fix text wrapping and apply fonts to the SVG
      const preparedSvg = prepareSvgForExport(svgElement);

      if (!preparedSvg) {
        logError("[Mermaid Export] Failed to prepare SVG for PNG export");
        announceToScreenReader("Failed to prepare SVG for export");
        return;
      }

      // Get the viewBox values to determine true aspect ratio
      const viewBox = preparedSvg.getAttribute("viewBox");
      let viewBoxWidth, viewBoxHeight, originalAspectRatio;

      if (viewBox) {
        const viewBoxValues = viewBox.split(" ").map(parseFloat);
        if (viewBoxValues.length === 4) {
          viewBoxWidth = viewBoxValues[2];
          viewBoxHeight = viewBoxValues[3];
          originalAspectRatio = viewBoxWidth / viewBoxHeight;
          logDebug(
            `[Mermaid Export] ViewBox dimensions: ${viewBoxWidth} x ${viewBoxHeight}, aspect ratio: ${originalAspectRatio}`
          );
        }
      }

      // Get SVG element dimensions as fallback
      const svgWidth =
        parseFloat(preparedSvg.getAttribute("width")) ||
        viewBoxWidth ||
        config.minWidth;
      const svgHeight =
        parseFloat(preparedSvg.getAttribute("height")) ||
        viewBoxHeight ||
        config.minHeight;

      // Use the more reliable aspect ratio
      if (!originalAspectRatio) {
        originalAspectRatio = svgWidth / svgHeight;
        logDebug(
          `[Mermaid Export] Using SVG dimensions: ${svgWidth} x ${svgHeight}, aspect ratio: ${originalAspectRatio}`
        );
      }

      // Calculate proper PNG dimensions while preserving aspect ratio
      let width, height;

      // Start with a reasonable base size that respects the aspect ratio
      const targetWidth = Math.max(svgWidth, 800); // Minimum reasonable width
      const targetHeight = Math.max(svgHeight, 600); // Minimum reasonable height

      // Determine which dimension to use as the base and scale accordingly
      if (originalAspectRatio > 1) {
        // Width is greater than height (landscape)
        width = Math.min(targetWidth, 1600); // Cap at reasonable maximum
        height = width / originalAspectRatio;
      } else {
        // Height is greater than width (portrait) or square
        height = Math.min(targetHeight, 1200); // Cap at reasonable maximum
        width = height * originalAspectRatio;
      }

      // Apply minimum constraints only if they don't severely distort the aspect ratio
      const minWidth = 600; // Reduced from 700 to be less aggressive
      const minHeight = 400; // Reduced from 900 to be less aggressive

      if (width < minWidth) {
        const scaleFactor = minWidth / width;
        width = minWidth;
        height = height * scaleFactor;
      }

      if (height < minHeight) {
        const scaleFactor = minHeight / height;
        height = minHeight;
        width = width * scaleFactor;
      }

      // Final constraint to prevent excessively large images
      const maxDimension = 2400;
      if (width > maxDimension || height > maxDimension) {
        const scale = Math.min(maxDimension / width, maxDimension / height);
        width = width * scale;
        height = height * scale;
      }

      // Round to whole numbers
      width = Math.round(width);
      height = Math.round(height);

      // Raster at pngScale, lowered only where the canvas would pass
      // maxCanvasPixels, which some browsers refuse outright (F19). A large
      // near-square diagram reaches it: its 1600-wide base is about 22.8
      // million pixels at 3x.
      const canvasScale = Math.min(
        config.pngScale,
        Math.sqrt(config.maxCanvasPixels / (width * height))
      );

      // Create a canvas with the proper dimensions and scale
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(width * canvasScale);
      canvas.height = Math.floor(height * canvasScale);
      logDebug(
        `[Mermaid Export] Canvas ${canvas.width}x${canvas.height} at scale ${canvasScale}`
      );

      const ctx = canvas.getContext("2d");
      ctx.scale(canvasScale, canvasScale);

      // Draw the diagram's own ground under the raster, not a hard-coded white.
      // MEASURED 30 August 2026: the clone's inline `background-color` DOES
      // reach the rasterised pixel - a dark xychart's corner pixel read
      // rgb(30, 30, 30) through this same canvas path while it was still being
      // painted white first. So this underlay is normally invisible, and it is
      // put in step anyway because the one case that would expose it is a clone
      // whose background resolved to something transparent, which is exactly
      // the case a hard-coded white gets wrong.
      ctx.fillStyle =
        preparedSvg.style.backgroundColor || FALLBACK_EXPORT_BACKGROUND;
      ctx.fillRect(0, 0, width, height);

      logDebug("[Mermaid Export] Canvas prepared, converting SVG to data URL");

      // Convert SVG to data URL
      const svgData = new XMLSerializer().serializeToString(preparedSvg);

      // Fix any namespace issues
      const svgDataFixed = svgData
        .replace(/NS\d+:xmlns/g, "xmlns")
        .replace(/xmlns:NS\d+=""/g, "");

      const svgUrl =
        "data:image/svg+xml;base64," +
        btoa(unescape(encodeURIComponent(svgDataFixed)));

      logDebug(
        `[Mermaid Export] SVG data URL created, length: ${svgUrl.length}`
      );

      // Create an image and draw it to the canvas when loaded
      const img = new Image();

      img.onload = function () {
        logDebug(
          "[Mermaid Export] Image loaded successfully, drawing to canvas"
        );

        // Draw the image
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to PNG with maximum quality
        const pngUrl = canvas.toDataURL("image/png", 1.0); // Maximum quality

        logInfo("[Mermaid Export] PNG conversion completed with high DPI");
        logDebug(
          `[Mermaid Export] Final PNG file estimated size: ~${Math.round(
            (pngUrl.length * 0.75) / 1024
          )}KB`
        );

        // Create download link
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `diagram-${id}.png`;

        // Trigger download
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        logInfo(
          `[Mermaid Export] PNG export completed successfully for diagram ${id}`
        );
        // Announce to screen readers
        announceToScreenReader("PNG downloaded successfully");
      };

      img.onerror = function (e) {
        logError("[Mermaid Export] Error loading SVG for PNG conversion:", e);
        logDebug(
          "[Mermaid Export] SVG data causing error (first 200 chars):",
          svgUrl.substring(0, 200) + "..."
        );
        announceToScreenReader("Failed to convert SVG to PNG");
      };

      img.src = svgUrl;
    } catch (error) {
      logError("[Mermaid Export] Error exporting PNG:", error);
      announceToScreenReader("Failed to download PNG");
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  function announceToScreenReader(message) {
    // Find or create screen reader announcer
    let announcer = document.getElementById(config.ariaLiveRegionId);

    if (!announcer) {
      // Create screen reader announcer element
      announcer = document.createElement("div");
      announcer.id = config.ariaLiveRegionId;
      announcer.className = "sr-only";
      announcer.setAttribute("aria-live", "polite");
      announcer.setAttribute("aria-atomic", "true");
      document.body.appendChild(announcer);

      // Add necessary CSS if not already present
      if (!document.getElementById("sr-styles")) {
        const style = document.createElement("style");
        style.id = "sr-styles";
        style.textContent = `
              .sr-only {
                  position: absolute;
                  width: 1px;
                  height: 1px;
                  padding: 0;
                  margin: -1px;
                  overflow: hidden;
                  clip: rect(0, 0, 0, 0);
                  white-space: nowrap;
                  border: 0;
              }
            `;
        document.head.appendChild(style);
      }
    }

    // Set the message to be announced
    announcer.textContent = message;
  }

  // Module initialised message
  logInfo("[Mermaid Export] Export utilities module initialised");

  // Public API
  return {
    exportAsSvg: exportAsSvg,
    exportAsPng: exportAsPng,
    prepareSvgForExport: prepareSvgForExport,
    prepareStaticExport: prepareStaticExport,
    prepareThemedStaticExport: prepareThemedStaticExport,
    THEMED_EXPORT_HEAD: THEMED_EXPORT_HEAD,
    config: config, // Expose config for external modification if needed
  };
})();
