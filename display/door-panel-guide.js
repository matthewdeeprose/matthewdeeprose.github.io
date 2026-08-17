/* ====================================================================
   DOOR PANEL GUIDE - step 1: lines.

   A guided journey over the studio's exported engine. This file owns
   NO measurement mathematics of its own beyond the fit budget's
   part-by-part arithmetic, which is checked against the rendered panel
   to within a pixel every time it runs. Everything else - geometry,
   cap heights, reading distances, character fitting - is the engine's
   (window.DoorPanelStudio), loaded from door-panel-studio-app.js with
   the studio's page absent, so only the exports are live.
   ==================================================================== */
(function () {
  "use strict";

  // Logging configuration (inside IIFE scope)
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
    if (shouldLog(LOG_LEVELS.ERROR)) console.error(message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn(message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log(message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log(message, ...args);
  }

  /* ------------------------------------------------------------------
     The engine. app.js loads BEFORE this file (the script order in the
     HTML is load-bearing), so the export exists by the time this runs.
     ------------------------------------------------------------------ */
  const S = window.DoorPanelStudio;

  // The CSS reference: 96 px to the inch, 25.4 mm to the inch. Derived
  // here rather than typed as 3.78, per the single-source rule.
  const CSS_PX_PER_MM = 96 / 25.4;

  // A pixel of slack for sub-pixel layout rounding - the same figure
  // the studio's body-accounting canary uses.
  const CLOSURE_TOLERANCE_PX = 1;

  // Vertical room the preview column needs around the frame (heading,
  // captions, the meter and its sentence), so the sticky column stays
  // shorter than the viewport and keeps pinning.
  const PREVIEW_RESERVE_PX = 340;

  // The smallest frame worth drawing. Below this the preview stops
  // being a preview.
  const FRAME_FLOOR_PX = 240;

  // The estate's reading distances - the guidance's own four rungs,
  // stated as distances because distance is the model.
  const DISTANCE_CHOICES = Object.freeze([
    Object.freeze({ mm: 600, label: "60 cm" }),
    Object.freeze({ mm: 700, label: "70 cm" }),
    Object.freeze({ mm: 1000, label: "1 m" }),
    Object.freeze({ mm: 1400, label: "1.4 m" }),
  ]);

  /* ------------------------------------------------------------------
     Colour-step constants.
     ------------------------------------------------------------------ */

  // The programme's bar for a pair of statuses (delta E CIE76). The
  // 2.3 just-noticeable figure and this bar are both recorded in the
  // programme background; the bar is what a pair is compared against.
  const DELTA_E_PAIR_BAR = 20;

  // The studio's own scheme cross-check tolerance (its
  // SCHEME_PROBE_TOLERANCE). Two instruments must agree within
  // rounding; a bigger gap is a finding about one of them.
  const SCHEME_PROBE_TOLERANCE = 0.15;

  // Recorded figures this page must reproduce, or stop:
  // the viable pool (panel-fill-options.md, 14 August 2026), and
  // Scheme B's word Lc readings (iteration 11 record).
  const RECORDED_POOL_COUNT = 22;
  const RECORDED_PALETTE_COUNT = 45;
  const RECORDED_B_WORD_LC = Object.freeze([102, 61, 73]);

  // A colour the pool must REFUSE - the most vivid traffic-light red
  // fails the word gate in both polarities (recorded in the fill
  // options probe). A pool check with no refused colour could pass by
  // admitting everything.
  const DENY_POOL_HEX = "#e63037"; // Horizon 02

  // How each measured mode reads in a sentence.
  const MODE_WORDS = Object.freeze({
    none: "normal vision",
    protanopia: "red-green colour blindness (protan)",
    deuteranopia: "red-green colour blindness (deutan)",
    tritanopia: "blue-yellow colour blindness (tritan)",
    greyscale: "greyscale",
  });

  /* ------------------------------------------------------------------
     Guide state: one distance per distance group, one include flag per
     toggleable line. The defaults reproduce the studio's recommended
     panel (the guidance's own reading plan), which is the ALLOW state
     of the fit canary - it must fit.
     ------------------------------------------------------------------ */
  const DISTANCE_DEFAULTS = Object.freeze({
    "status-text": 1400,
    times: 700,
    room: 1000,
    code: 600,
    title: 700,
    clock: 600,
  });

  const chosenDistance = Object.assign({}, DISTANCE_DEFAULTS);

  const included = {
    status: true,
    timesroom: true,
    code: true,
    title: true,
  };

  const el = {};
  let engineState = null;
  let frameHeightPx = 0;
  let lastBudget = null;
  let announceEnabled = false;
  let lastAnnounced = "";
  let chipPool = [];

  /* ------------------------------------------------------------------
     Engine state. The studio fills its state inside init(), which the
     engine guard now skips on this page, so the guide seeds its own
     from the SAME statements: role defaults, as-built rem multipliers
     converted through the current geometry, and the recommended-panel
     settings (Scheme B fills, short status wording, the measured
     badge-padding frontier, the stated 1.5 spacing).
     ------------------------------------------------------------------ */
  function buildEngineState() {
    const st = S.cloneState(S.state);
    const geometry = S.Engine.computeGeometry(st.geometry);

    S.Model.allRoles().forEach((role) => {
      st.colours[role.id] = role.defaultHex;
      if (role.asBuiltRem !== undefined) {
        st.caps[role.id] = S.Engine.fontToCapMm(
          role.asBuiltRem * geometry.rootFontMm,
          st.geometry.capRatio
        );
      }
      if (role.asBuiltThicknessPx !== undefined) {
        st.thickness[role.id] = role.asBuiltThicknessPx * geometry.mmPerPx;
      }
      if (role.asBuiltThicknessRem !== undefined) {
        st.thickness[role.id] =
          role.asBuiltThicknessRem * geometry.rootFontMm;
      }
    });

    st.lineHeight = S.Model.RECOMMENDED_LINE_SPACING;
    st.badge.padY = S.Model.RECOMMENDED_BADGE_PADDING.padY;
    st.badge.padX = S.Model.RECOMMENDED_BADGE_PADDING.padX;
    st.badge.borderMode = S.Model.BADGE_BORDER_AUTO_MODE;

    const scheme = S.Model.PANEL_SCHEMES.filter(
      (entry) => entry.id === S.Model.DEFAULT_SCHEME_ID
    )[0];
    S.Model.STATUSES.forEach((status, index) => {
      const short = S.Model.RECOMMENDED_STATUS_LABELS[status.id];
      if (short) st.statusLabels[status.id] = short;
      st.colours["status-fill-" + status.id] = scheme.fills[index];
    });
    st.scheme = scheme.id;
    st.simulation = "none";
    return st;
  }

  /* ------------------------------------------------------------------
     Choices into state. Every cap comes from the chosen distance
     through the engine's own conversion, clamped at the engine's own
     floors - the room name's 10 mm floor is the one that binds at the
     nearer choices, and the derived sentence says so when it does.
     ------------------------------------------------------------------ */
  function applyChoices(st) {
    Object.keys(chosenDistance).forEach((roleId) => {
      const role = S.Model.roleById(roleId);
      const wanted = S.Model.capForReadingDistance(chosenDistance[roleId]);
      st.caps[roleId] = Math.max(S.Model.floorCapMmFor(role), wanted);
    });
    // One choice covers the header pair: the date sits under the clock
    // and reads from the same place.
    st.caps.date = st.caps.clock;

    const timesValue = el.contentTimes.value;
    const roomValue = el.contentRoom.value;
    st.content.times = timesValue;
    // The " | " separator is plumbing between the two roles, not part
    // of the room's name - the guide manages it so the person never
    // has to type it.
    st.content.room = roomValue
      ? (timesValue ? " | " + roomValue : roomValue)
      : "";
    st.content.code = el.contentCode.value;
    st.content.title = el.contentTitle.value;
  }

  /* ------------------------------------------------------------------
     Frame sizing. True scale is the point: 135.9 mm of panel at the
     CSS reference 96 dpi. Where the window cannot hold that, the frame
     shrinks and the caption SAYS it is scaled - never silently.
     ------------------------------------------------------------------ */
  function trueScaleFramePx() {
    return engineState.geometry.panelHmm * CSS_PX_PER_MM;
  }

  function fitFrame() {
    const trueH = trueScaleFramePx();
    const aspect =
      engineState.geometry.panelWmm / engineState.geometry.panelHmm;
    const docW = document.documentElement.clientWidth;
    // 87.5rem is the stylesheet's stacking breakpoint; 1400 is the same
    // figure at the 16 px root this page runs at.
    const twoColumns = docW > 1400;
    const availableW = twoColumns ? docW - 320 - 24 - 48 : docW - 48;
    const availableH = window.innerHeight - PREVIEW_RESERVE_PX;
    const bezelPx = 24; // 0.75rem borders both sides, from the studio sheet
    frameHeightPx = Math.max(
      FRAME_FLOOR_PX,
      Math.min(trueH, availableH, (availableW - bezelPx) / aspect)
    );

    const percent = Math.round((frameHeightPx / trueH) * 100);
    el.scaleNote.textContent =
      percent >= 100
        ? "This preview is true scale. Hold a ruler to the screen: the panel is " +
          engineState.geometry.panelHmm +
          " mm tall."
        : "Shown at " +
          percent +
          " per cent of true size. Your window is too small for true scale.";
  }

  /* ------------------------------------------------------------------
     THE FIT BUDGET.

     Two halves, kept apart so each can catch the other lying:

     - the ARITHMETIC half predicts each visible body line's height
       from state alone (font, spacing, padding, border - the same
       statements the stylesheet renders from);
     - the MEASURED half reads the rendered boxes back, the studio's
       body-accounting shape: every visible child's rect plus its top
       margin, against the body's own box.

     Each unwrapped text line must close to within a pixel. A line that
     has wrapped is not closed - the wrap itself is the finding, and it
     is reported in words instead.

     The divider is measured, not predicted: it is fixed furniture from
     the studio's stylesheet (which this page links), and no choice on
     this page can move it.
     ------------------------------------------------------------------ */
  function bodyChildName(child) {
    const names = {
      dpgBadgeLine: "status word",
      dpgTimesRoomLine: "times and room name",
      dpgCodeLine: "course code",
      dpgTitleLine: "booking title",
    };
    return names[child.id] || "divider";
  }

  function computeBudget(derived) {
    const st = engineState;
    const mmPx = frameHeightPx / st.geometry.panelHmm;
    const lh = st.lineHeight;
    const rootFontPx = derived.geometry.rootFontMm * mmPx;
    const previewFontPx = (id) =>
      derived.byId[id] && derived.byId[id].fontMm !== undefined
        ? derived.byId[id].fontMm * mmPx
        : 0;

    // The engine's fit report: panel-scale character/line arithmetic
    // plus the clipping half read from this page's own surface.
    const fit = S.measureFit(el.surface, derived);
    const rowById = {};
    fit.rows.forEach((row) => {
      rowById[row.id] = row;
    });

    // Panel-scale figures for the wrap test on the shared line. The
    // two roles render side by side, so the pair can overflow the
    // width even when each alone would fit.
    const panelPxPerMm = derived.geometry.pxPerMmHeight;
    const bodyWidthPanelPx = fit.bodyWidthMm * panelPxPerMm;

    const warnings = [];
    const closures = [];
    const predictions = [];

    if (included.status) {
      const f = previewFontPx("status-text");
      const fillHex = st.colours["status-fill-" + st.statusId];
      const outlined = st.badge.style === S.Model.BADGE_STYLE_OUTLINED;
      const borderPx =
        outlined || S.borderOnFor(fillHex, st)
          ? st.badge.borderMm * mmPx
          : 0;
      const wrapped = rowById["status-text"]
        ? rowById["status-text"].linesNeeded > 1
        : false;
      if (wrapped) {
        warnings.push("The status word no longer fits on one line.");
      }
      predictions.push({
        element: el.badgeLine,
        name: "status word",
        needPx: f * lh + 2 * (st.badge.padY * f + borderPx),
        marginPx: 0.1 * f,
        wrapped: wrapped,
      });
    }

    if (included.timesroom) {
      const timesRow = rowById.times;
      const roomRow = rowById.room;
      const combinedPanelPx =
        (timesRow && st.content.times
          ? S.measureWidth(
              st.content.times,
              derived.byId.times.fontMm * panelPxPerMm,
              lh,
              false
            )
          : 0) +
        (roomRow && st.content.room
          ? S.measureWidth(
              st.content.room,
              derived.byId.room.fontMm * panelPxPerMm,
              lh,
              false
            )
          : 0);
      const wrapped = combinedPanelPx > bodyWidthPanelPx;
      if (wrapped) {
        warnings.push(
          "The times and room name no longer fit on one line together."
        );
      }
      // Both spans sit in the line whatever their content, and an
      // empty inline box still carries its font's line height - so the
      // taller of the two fonts sets the line, content or no content.
      const tallest = Math.max(
        previewFontPx("times"),
        previewFontPx("room")
      );
      predictions.push({
        element: el.timesRoomLine,
        name: "times and room name",
        needPx: 0.5 * rootFontPx + Math.max(rootFontPx, tallest) * lh,
        marginPx: 0,
        wrapped: wrapped,
      });
    }

    if (included.code) {
      const f = previewFontPx("code");
      const wrapped = rowById.code ? rowById.code.linesNeeded > 1 : false;
      if (wrapped) {
        warnings.push("The course code no longer fits on one line.");
      }
      predictions.push({
        element: el.codeLine,
        name: "course code",
        needPx: 0.5 * f + f * lh,
        marginPx: 0,
        wrapped: wrapped,
      });
    }

    // The booking title's box is elastic (it takes whatever the lines
    // above leave), so its check is need-against-box, not a closure.
    const titleFontPx = previewFontPx("title");
    const titleLinesNeeded =
      included.title && rowById.title ? rowById.title.linesNeeded : 0;
    const titleNeedPx = included.title
      ? 0.5 * titleFontPx + titleLinesNeeded * titleFontPx * lh
      : 0;

    // ---- The measured half -------------------------------------
    const bodyRect = el.body.getBoundingClientRect();
    const availablePx = bodyRect.height;
    let dividerPx = 0;
    let dividerMarginPx = 0;
    let titleBoxPx = 0;
    let clippedName = "";
    Array.prototype.forEach.call(el.body.children, (child) => {
      if (child.hidden) return;
      const style = getComputedStyle(child);
      const rect = child.getBoundingClientRect();
      const marginTop = parseFloat(style.marginTop) || 0;
      if (child.id === "dpgTitleLine") {
        titleBoxPx = rect.height;
      } else if (!child.id) {
        dividerPx = rect.height;
        dividerMarginPx = marginTop;
      }
      if (rect.bottom - bodyRect.bottom > CLOSURE_TOLERANCE_PX) {
        clippedName = bodyChildName(child);
      }
    });

    // ---- Closure: arithmetic against rendered, per unwrapped line
    let neededPx = titleNeedPx + dividerPx + dividerMarginPx;
    predictions.forEach((part) => {
      const rect = part.element.getBoundingClientRect();
      if (part.wrapped) {
        // The prediction assumed one line and the line has wrapped;
        // the rendered height is the truth, and the wrap is already
        // reported in words.
        neededPx += part.marginPx + rect.height;
        closures.push({
          name: part.name,
          agrees: true,
          skipped: true,
          deltaPx: null,
        });
        return;
      }
      neededPx += part.marginPx + part.needPx;
      const deltaPx = Math.abs(rect.height - part.needPx);
      closures.push({
        name: part.name,
        agrees: deltaPx <= CLOSURE_TOLERANCE_PX,
        skipped: false,
        deltaPx: deltaPx,
      });
    });

    const overflowPx = neededPx - availablePx;
    const fits = overflowPx <= CLOSURE_TOLERANCE_PX;
    const titleShort =
      included.title &&
      titleNeedPx > titleBoxPx + CLOSURE_TOLERANCE_PX;

    // Who loses when there is not enough room: the elastic title box
    // shrinks first, so it is named first; otherwise whichever child
    // the measured walk saw crossing the body's bottom edge.
    let losingLine = "";
    if (!fits || titleShort) {
      losingLine = titleShort ? "booking title" : clippedName;
    }

    const percent =
      availablePx > 0 ? Math.round((neededPx / availablePx) * 100) : 0;

    return {
      percent: percent,
      neededPx: neededPx,
      availablePx: availablePx,
      overflowPx: overflowPx,
      fits: fits && !titleShort,
      warnings: warnings,
      losingLine: losingLine,
      closures: closures,
      clipMeasured: fit.clipMeasured,
      ok: fits && !titleShort && warnings.length === 0,
    };
  }

  function budgetSentence(budget) {
    if (!budget.clipMeasured) {
      return "The preview could not be measured. Make the window larger and try again.";
    }
    let sentence =
      "Your lines use " +
      budget.percent +
      " per cent of the panel body.";
    if (budget.fits) {
      sentence += " Everything fits.";
    } else {
      sentence +=
        " That is too much for the panel. Drop a line, use shorter words, or pick a nearer reading distance.";
      if (budget.losingLine) {
        sentence +=
          " The " + budget.losingLine + " is the line that gets cut off.";
      }
    }
    budget.warnings.forEach((warning) => {
      sentence += " " + warning;
    });
    return sentence;
  }

  // The budget's OWN last sentence, tracked apart from the region's
  // last write: the region also carries colour verdicts, and comparing
  // against whatever spoke last made an unchanged budget re-announce
  // after every colour event - one event, two announcements. Measured
  // on the first step 2 drive (a preset click produced two region
  // writes) and fixed by giving each message stream its own memory.
  let lastBudgetSentence = "";

  function renderBudget(budget) {
    const sentence = budgetSentence(budget);
    el.budgetSentence.textContent = sentence;
    el.budgetSentence.classList.toggle("dpg-budget-over", !budget.ok);
    el.meterFill.style.width = Math.min(100, budget.percent) + "%";
    el.meterFill.classList.toggle("dpg-meter-over", !budget.ok);
    if (sentence !== lastBudgetSentence) {
      lastBudgetSentence = sentence;
      announceVerdict(sentence);
    }
  }

  /* ------------------------------------------------------------------
     One long-lived polite region, written only when the message
     changes, and never for the page's own initial set - the same
     announce-changes-not-initial-set rule the rest of the codebase
     follows.
     ------------------------------------------------------------------ */
  function announceVerdict(message) {
    if (!announceEnabled) {
      lastAnnounced = message;
      return;
    }
    if (message === lastAnnounced) return;
    lastAnnounced = message;
    el.live.textContent = message;
  }

  /* ------------------------------------------------------------------
     Derived-size sentences, one per distance group.
     ------------------------------------------------------------------ */
  function distanceWords(mm) {
    if (mm < 1000) return Math.round(mm / 10) + " cm";
    const metres = mm / 1000;
    return (Math.round(metres * 10) / 10) + " m";
  }

  function roundedMm(value) {
    return Math.round(value * 10) / 10;
  }

  function derivedSentenceFor(roleId, derived) {
    const record = derived.byId[roleId];
    if (!record || record.capMm === undefined) return "";
    const chosenMm = chosenDistance[roleId];
    const wantedCap = S.Model.capForReadingDistance(chosenMm);
    const cap = record.capMm;
    if (cap > wantedCap + 1e-9) {
      // The engine's floor bound the choice - say so, in the floor's
      // own terms, rather than silently doing something different.
      return (
        "Room names never go below " +
        roundedMm(cap) +
        " mm capitals - the guidance's own floor - so this stays at " +
        roundedMm(cap) +
        " mm, readable from about " +
        distanceWords(S.Model.readingDistanceForCap(cap)) +
        "."
      );
    }
    return (
      "Capitals " +
      roundedMm(cap) +
      " mm tall - readable from about " +
      distanceWords(chosenMm) +
      "."
    );
  }

  function renderDerivedSentences(derived) {
    el.derivedStatus.textContent = derivedSentenceFor(
      "status-text",
      derived
    );
    el.derivedTimes.textContent = derivedSentenceFor("times", derived);
    el.derivedRoom.textContent = derivedSentenceFor("room", derived);
    el.derivedCode.textContent = derivedSentenceFor("code", derived);
    el.derivedTitle.textContent = derivedSentenceFor("title", derived);
    el.derivedDatetime.textContent = derivedSentenceFor("clock", derived);
  }

  /* ------------------------------------------------------------------
     STEP 2: COLOURS.

     The chip pool is the fills that clear the page background on their
     own (the engine's fillCarriesItsOwnEdge - the auto-border rule
     would draw nothing on them) AND carry the status word at its own
     gate. Both tests are the engine's; this file only asks them.
     ------------------------------------------------------------------ */
  function wordGateNow() {
    return S.gateFor(
      S.Model.roleById("status-text"),
      engineState.caps["status-text"],
      engineState
    );
  }

  function wordCarriedOn(fillHex) {
    const gate = wordGateNow();
    const onFill = S.Engine.contrastPair(
      engineState.colours["status-text"],
      fillHex
    );
    return onFill.wcag >= gate.wcag && onFill.lc >= gate.lc;
  }

  function buildChipPool() {
    return engineState.palette
      .filter(
        (colour) =>
          S.fillCarriesItsOwnEdge(colour.hex, engineState) &&
          wordCarriedOn(colour.hex)
      )
      .map((colour) => ({ name: colour.name, hex: colour.hex }));
  }

  function paletteNameFor(hex) {
    const wanted = String(hex).toLowerCase();
    const match = engineState.palette.filter(
      (colour) => colour.hex.toLowerCase() === wanted
    )[0];
    return match ? match.name : hex;
  }

  function wordingFor(statusId) {
    return (
      engineState.statusLabels[statusId] ||
      S.Model.STATUSES.filter((status) => status.id === statusId)[0].label
    );
  }

  /* ------------------------------------------------------------------
     Ratings, from the derived object - the same reduction the studio
     paints from, so a figure here cannot drift from the panel.
     ------------------------------------------------------------------ */
  function pairsFor(statusId, derived) {
    return derived.pairs.filter(
      (pair) =>
        pair.a.status.id === statusId || pair.b.status.id === statusId
    );
  }

  function otherWordingOf(pair, statusId) {
    return pair.a.status.id === statusId ? pair.b.label : pair.a.label;
  }

  function closestBoundPair(statusId, derived) {
    let closest = null;
    pairsFor(statusId, derived).forEach((pair) => {
      if (!closest || pair.minDeltaE < closest.minDeltaE) closest = pair;
    });
    return closest;
  }

  function greyscaleClosest(statusId, derived) {
    const grey = window.ContrastCardsCVD.MODES.GREYSCALE;
    let closest = null;
    pairsFor(statusId, derived).forEach((pair) => {
      const value = pair.perMode[grey].deltaE;
      if (!closest || value < closest.value) {
        closest = { value: value, pair: pair };
      }
    });
    return closest;
  }

  function round1(value) {
    return Math.round(value * 10) / 10;
  }

  function ratingSentences(statusId, derived) {
    const index = S.Model.STATUSES.findIndex(
      (status) => status.id === statusId
    );
    const fillRecord = derived.byId["status-fill-" + statusId];
    const wordRecord = derived.byId["status-text"];
    const sentences = [];

    // The word, on THIS fill. surfacesFor lists the fills in status
    // order, so the index lines up by construction.
    const onFill = wordRecord.surfaces[index];
    const wordGate = wordRecord.gate;
    sentences.push(
      "The word on this colour: " +
        onFill.wcag +
        ":1, Lc " +
        onFill.lc +
        ". Its gate is " +
        wordGate.wcag +
        ":1 and Lc " +
        wordGate.lc +
        " - " +
        (onFill.passesWcag && onFill.passesApca
          ? "it clears it."
          : "it MISSES it.")
    );

    // The fill, against the page - and what the auto-border rule did.
    const onPage = fillRecord.surfaces[0];
    const borderDrawn = S.borderOnFor(
      engineState.colours["status-fill-" + statusId],
      engineState
    );
    sentences.push(
      "The colour against the page: " +
        onPage.wcag +
        ":1, Lc " +
        onPage.lc +
        ". " +
        (borderDrawn
          ? "It needs help, so the auto-border rule draws a border."
          : "It stands out on its own, so no border is drawn.")
    );

    // Separation from the other two statuses, over the counted modes.
    const closest = closestBoundPair(statusId, derived);
    if (closest) {
      sentences.push(
        "Against the other statuses: the closest counted pair is delta E " +
          round1(closest.minDeltaE) +
          ", against " +
          otherWordingOf(closest, statusId) +
          ", in " +
          MODE_WORDS[closest.worstMode] +
          " - " +
          (closest.minDeltaE >= DELTA_E_PAIR_BAR
            ? "past the 20 bar."
            : "under the 20 bar.")
      );
    }

    // Greyscale, always shown, counted only when ticked.
    const grey = greyscaleClosest(statusId, derived);
    if (grey) {
      let sentence =
        "In greyscale the closest pair is delta E " +
        round1(grey.value) +
        ", against " +
        otherWordingOf(grey.pair, statusId) +
        ".";
      if (grey.value < DELTA_E_PAIR_BAR) {
        sentence +=
          " At that gap the colours look alike in grey - the word carries the difference.";
      }
      sentence += engineState.designFor.greyscale
        ? " Greyscale is ticked under Design for, so it counts in the figure above."
        : " We measure and show it; it only counts when you tick it under Design for. No rule sets a limit on it.";
      sentences.push(sentence);
    }

    return sentences;
  }

  function renderRatings(derived) {
    S.Model.STATUSES.forEach((status) => {
      const host = document.getElementById("dpgRatings-" + status.id);
      if (!host) return;
      host.textContent = "";
      ratingSentences(status.id, derived).forEach((sentence) => {
        const line = document.createElement("p");
        line.textContent = sentence;
        host.appendChild(line);
      });
    });
  }

  /* ------------------------------------------------------------------
     Colour controls: state radios, scheme presets, chips.
     ------------------------------------------------------------------ */
  function schemeMatching(st) {
    const current = S.Model.STATUSES.map(
      (status) => st.colours["status-fill-" + status.id].toLowerCase()
    ).join("|");
    const match = S.Model.PANEL_SCHEMES.filter(
      (scheme) =>
        scheme.fills.map((hex) => hex.toLowerCase()).join("|") === current
    )[0];
    return match ? match.id : "custom";
  }

  function syncColourControls() {
    const schemeId = schemeMatching(engineState);
    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="dpgScheme"]'),
      (input) => {
        input.checked = input.value === schemeId;
      }
    );
    S.Model.STATUSES.forEach((status) => {
      const hex = engineState.colours["status-fill-" + status.id];
      Array.prototype.forEach.call(
        document.querySelectorAll(
          'input[name="dpgChip-' + status.id + '"]'
        ),
        (input) => {
          input.checked =
            input.value.toLowerCase() === hex.toLowerCase();
        }
      );
    });
  }

  function chipVerdict(statusId, derived) {
    const index = S.Model.STATUSES.findIndex(
      (status) => status.id === statusId
    );
    const hex = engineState.colours["status-fill-" + statusId];
    const onFill = derived.byId["status-text"].surfaces[index];
    const onPage = derived.byId["status-fill-" + statusId].surfaces[0];
    const closest = closestBoundPair(statusId, derived);
    return (
      paletteNameFor(hex) +
      " for " +
      wordingFor(statusId) +
      ". Word on it " +
      onFill.wcag +
      ":1. Against the page " +
      onPage.wcag +
      ":1, no border needed. Closest counted pair delta E " +
      (closest ? round1(closest.minDeltaE) : 0) +
      " in " +
      (closest ? MODE_WORDS[closest.worstMode] : "no mode") +
      (closest
        ? closest.minDeltaE >= DELTA_E_PAIR_BAR
          ? " - past the 20 bar."
          : " - under the 20 bar."
        : ".")
    );
  }

  function buildStateRadios() {
    S.Model.STATUSES.forEach((status) => {
      const wrap = document.createElement("div");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "dpgShowState";
      input.id = "dpgShowState-" + status.id;
      input.value = status.id;
      input.checked = engineState.statusId === status.id;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        engineState.statusId = status.id;
        // The radio announces itself; the repaint says nothing new,
        // so nothing else speaks.
        refresh();
      });
      const label = document.createElement("label");
      label.setAttribute("for", input.id);
      label.textContent = wordingFor(status.id);
      wrap.appendChild(input);
      wrap.appendChild(label);
      el.stateRadios.appendChild(wrap);
    });
  }

  function applyGuideScheme(schemeId) {
    const scheme = S.Model.PANEL_SCHEMES.filter(
      (entry) => entry.id === schemeId
    )[0];
    if (!scheme) return;
    // The studio's applyScheme lesson: a chosen colour must never sit
    // beside a readout claiming the pool excludes it. This page never
    // sets a ceiling or floor, and the guide state carries none - both
    // stay null - so the pool the chips show cannot disagree with the
    // choice being applied. Asserted in the colour checks.
    S.Model.STATUSES.forEach((status, index) => {
      engineState.colours["status-fill-" + status.id] =
        scheme.fills[index];
    });
    engineState.scheme = scheme.id;
    const done = refresh();
    const names = S.Model.STATUSES.map(
      (status, index) =>
        paletteNameFor(scheme.fills[index]) + " for " + wordingFor(status.id)
    ).join(", ");
    announceVerdict(
      scheme.label +
        " applied: " +
        names +
        ". Closest counted pair delta E " +
        round1(done.derived.worstPair.minDeltaE) +
        " in " +
        MODE_WORDS[done.derived.worstPair.worstMode] +
        "."
    );
  }

  function buildSchemeRadios() {
    const entries = S.Model.PANEL_SCHEMES.map((scheme) => ({
      value: scheme.id,
      label: scheme.label,
    })).concat([
      { value: "custom", label: "My own mix - pick colours below" },
    ]);
    entries.forEach((entry) => {
      const wrap = document.createElement("div");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "dpgScheme";
      input.id = "dpgScheme-" + entry.value;
      input.value = entry.value;
      input.addEventListener("change", () => {
        if (!input.checked || entry.value === "custom") return;
        applyGuideScheme(entry.value);
      });
      const label = document.createElement("label");
      label.setAttribute("for", input.id);
      label.textContent = entry.label;
      wrap.appendChild(input);
      wrap.appendChild(label);
      el.schemeRadios.appendChild(wrap);
    });
  }

  function buildChips() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-status-chips]"),
      (host) => {
        const statusId = host.getAttribute("data-status-chips");
        chipPool.forEach((colour) => {
          const wrap = document.createElement("div");
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "dpgChip-" + statusId;
          input.id =
            "dpgChip-" + statusId + "-" + colour.hex.replace("#", "");
          input.value = colour.hex;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            engineState.colours["status-fill-" + statusId] = colour.hex;
            const done = refresh();
            // ONE announcement for the event: the chip's verdict.
            announceVerdict(chipVerdict(statusId, done.derived));
          });
          const label = document.createElement("label");
          label.setAttribute("for", input.id);
          const swatch = document.createElement("span");
          swatch.className = "dpg-swatch";
          swatch.setAttribute("aria-hidden", "true");
          swatch.style.background = colour.hex;
          label.appendChild(swatch);
          label.appendChild(document.createTextNode(colour.name));
          wrap.appendChild(input);
          wrap.appendChild(label);
          host.appendChild(wrap);
        });
      }
    );
  }

  function wireDesignFor() {
    el.designCvd.addEventListener("change", () => {
      engineState.designFor.colourBlindness = el.designCvd.checked;
      refresh();
    });
    el.designGrey.addEventListener("change", () => {
      engineState.designFor.greyscale = el.designGrey.checked;
      refresh();
    });
  }

  /* ------------------------------------------------------------------
     COLOUR CHECKS - the cross-instrument gate. The guide re-measures
     both recorded schemes through the engine and compares every figure
     with the probe recorded when the schemes were chosen. Includes a
     DENY row (a colour the pool must refuse) beside the positive
     rows, so a pool that admitted everything could not pass.
     ------------------------------------------------------------------ */
  function runColourChecks() {
    const rows = [];
    const modes = window.ContrastCardsCVD.getModes();
    const background = engineState.colours["page-bg"];

    rows.push({
      label:
        "The chip pool matches the recorded viable pool (fills that clear the page unaided and carry the word)",
      expected: RECORDED_POOL_COUNT + " of " + RECORDED_PALETTE_COUNT,
      actual: chipPool.length + " of " + engineState.palette.length,
      agrees:
        chipPool.length === RECORDED_POOL_COUNT &&
        engineState.palette.length === RECORDED_PALETTE_COUNT,
    });

    const denyAdmitted = chipPool.some(
      (colour) => colour.hex.toLowerCase() === DENY_POOL_HEX
    );
    rows.push({
      label:
        "DENY: the vivid traffic-light red (Horizon 02) is refused by the pool - it cannot carry the word",
      expected: "refused",
      actual: denyAdmitted ? "ADMITTED" : "refused",
      agrees: !denyAdmitted,
    });

    const presetFills = [];
    S.Model.PANEL_SCHEMES.forEach((scheme) => {
      scheme.fills.forEach((hex) => presetFills.push(hex));
    });
    const presetsInPool = presetFills.filter((hex) =>
      chipPool.some(
        (colour) => colour.hex.toLowerCase() === hex.toLowerCase()
      )
    ).length;
    rows.push({
      label:
        "Every preset fill sits in the chip pool, so applying a scheme can never disagree with the chips on offer",
      expected: presetFills.length + " of " + presetFills.length,
      actual: presetsInPool + " of " + presetFills.length,
      agrees: presetsInPool === presetFills.length,
    });

    S.Model.PANEL_SCHEMES.forEach((scheme) => {
      const perMode = {};
      modes.forEach((mode) => {
        perMode[mode] = Infinity;
      });
      for (let i = 0; i < scheme.fills.length; i += 1) {
        for (let j = i + 1; j < scheme.fills.length; j += 1) {
          const measured = window.ContrastCardsCVD.measurePair(
            scheme.fills[i],
            scheme.fills[j],
            { background: background, modes: modes }
          );
          modes.forEach((mode) => {
            if (measured[mode].deltaE < perMode[mode]) {
              perMode[mode] = measured[mode].deltaE;
            }
          });
        }
      }
      modes.forEach((mode) => {
        const computed = round1(perMode[mode]);
        const recorded = scheme.probe[mode];
        rows.push({
          label:
            "Scheme " +
            scheme.id +
            ", " +
            MODE_WORDS[mode] +
            ": this page's closest pair against the recorded probe",
          expected: "delta E " + recorded,
          actual: "delta E " + computed,
          agrees: Math.abs(computed - recorded) <= SCHEME_PROBE_TOLERANCE,
        });
      });

      const drawn = scheme.fills.filter((hex) =>
        S.borderOnFor(hex, engineState)
      ).length;
      rows.push({
        label:
          "Scheme " + scheme.id + ": no fill needs the auto-border rescue",
        expected: "0 borders",
        actual: drawn + " borders",
        agrees: drawn === 0,
      });
    });

    const bScheme = S.Model.PANEL_SCHEMES.filter(
      (scheme) => scheme.id === "B"
    )[0];
    const bWordLc = bScheme.fills.map(
      (hex) =>
        S.Engine.contrastPair(engineState.colours["status-text"], hex).lc
    );
    rows.push({
      label:
        "Scheme B: the word's Lc on each fill matches the iteration 11 record",
      expected: RECORDED_B_WORD_LC.join(", "),
      actual: bWordLc.join(", "),
      agrees:
        bWordLc.length === RECORDED_B_WORD_LC.length &&
        bWordLc.every(
          (value, index) => value === RECORDED_B_WORD_LC[index]
        ),
    });

    return rows;
  }

  /* ------------------------------------------------------------------
     The one recompute-and-repaint entry point, the studio's pattern.
     ------------------------------------------------------------------ */
  function refresh() {
    applyChoices(engineState);
    const derived = S.derive(engineState);
    S.paintPanel(el.panel, el.surface, derived, {
      frameHeightPx: frameHeightPx,
      simulation: "none",
    });
    el.badgeLine.hidden = !included.status;
    el.timesRoomLine.hidden = !included.timesroom;
    el.codeLine.hidden = !included.code;
    el.titleLine.hidden = !included.title;

    lastBudget = computeBudget(derived);
    renderBudget(lastBudget);
    renderDerivedSentences(derived);
    renderRatings(derived);
    syncColourControls();
    return { derived: derived, budget: lastBudget };
  }

  /* ------------------------------------------------------------------
     THE FIT CANARY - DENY and ALLOW, on the live frame.

     ALLOW: the shipped default (the guidance's own reading plan on the
     recommended panel) must fit, with every unwrapped line's
     arithmetic closing to within a pixel.

     DENY: every line read from 1.4 m must overflow, and the overflow
     must name a losing line. A budget that cannot go red is not a
     measurement.

     The canary mutates the live choices and puts them back in a
     finally, then ASSERTS the restoration by comparing the budget
     sentence before and after - a canary that left the page changed
     would poison every measurement after it.
     ------------------------------------------------------------------ */
  function runFitCanary() {
    const rows = [];
    const savedDistances = Object.assign({}, chosenDistance);
    const savedIncluded = Object.assign({}, included);
    const before = refresh();
    const beforeSentence = budgetSentence(before.budget);

    try {
      // ALLOW - the defaults.
      Object.assign(chosenDistance, DISTANCE_DEFAULTS);
      Object.keys(included).forEach((key) => {
        included[key] = true;
      });
      const allow = refresh();
      rows.push({
        label: "ALLOW: the default panel fits",
        expected: "fits, no warnings",
        actual: allow.budget.ok
          ? "fits, " + allow.budget.percent + " per cent used"
          : budgetSentence(allow.budget),
        agrees: allow.budget.ok,
      });
      const closed = allow.budget.closures.filter(
        (row) => !row.skipped
      );
      rows.push({
        label:
          "ALLOW: every text line's arithmetic was closed (positive canary - a page that closed nothing would also show no misses)",
        expected: "3 lines closed",
        actual: closed.length + " lines closed",
        agrees: closed.length === 3,
      });
      closed.forEach((row) => {
        rows.push({
          label:
            "ALLOW: the " +
            row.name +
            "'s predicted height matches its rendered height",
          expected: "within " + CLOSURE_TOLERANCE_PX + " px",
          actual: row.deltaPx.toFixed(2) + " px apart",
          agrees: row.agrees,
        });
      });

      // DENY - everything read from across the corridor.
      Object.keys(chosenDistance).forEach((key) => {
        chosenDistance[key] = 1400;
      });
      const deny = refresh();
      rows.push({
        label:
          "DENY: a panel with every line read from 1.4 m overflows the body",
        expected: "overflow",
        actual:
          deny.budget.overflowPx > CLOSURE_TOLERANCE_PX
            ? "overflows by " +
              Math.round(deny.budget.overflowPx) +
              " px (" +
              deny.budget.percent +
              " per cent needed)"
            : "did not overflow",
        agrees: deny.budget.overflowPx > CLOSURE_TOLERANCE_PX,
      });
      rows.push({
        label: "DENY: the overflow names the line that loses",
        expected: "a line is named",
        actual: deny.budget.losingLine
          ? "the " + deny.budget.losingLine
          : "no line named",
        agrees: Boolean(deny.budget.losingLine),
      });
    } finally {
      Object.assign(chosenDistance, savedDistances);
      Object.assign(included, savedIncluded);
      const after = refresh();
      const afterSentence = budgetSentence(after.budget);
      rows.push({
        label:
          "The canary put the page back exactly as it found it",
        expected: beforeSentence,
        actual: afterSentence,
        agrees: afterSentence === beforeSentence,
      });
    }
    return rows;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderChecksReport(rows) {
    const failed = rows.filter((row) => !row.agrees).length;
    el.checksReport.innerHTML =
      "<table><caption>The page's own checks - " +
      (failed === 0
        ? "all " + rows.length + " agree"
        : failed + " of " + rows.length + " disagree") +
      "</caption><thead><tr><th scope=\"col\">Check</th><th scope=\"col\">Expected</th><th scope=\"col\">Actual</th><th scope=\"col\">Verdict</th></tr></thead><tbody>" +
      rows
        .map(
          (row) =>
            "<tr><td>" +
            escapeHtml(row.label) +
            "</td><td>" +
            escapeHtml(row.expected) +
            "</td><td>" +
            escapeHtml(row.actual) +
            "</td><td>" +
            (row.agrees ? "agrees" : "DISAGREES") +
            "</td></tr>"
        )
        .join("") +
      "</tbody></table>";
  }

  /* ------------------------------------------------------------------
     Controls. The distance radios are generated from DISTANCE_CHOICES
     - the studio's controls-from-the-model pattern - so adding a rung
     is one data edit.
     ------------------------------------------------------------------ */
  function buildDistanceRadios() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-distance-group]"),
      (host) => {
        const roleId = host.getAttribute("data-distance-group");
        DISTANCE_CHOICES.forEach((choice) => {
          const wrap = document.createElement("div");
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "dpgDist-" + roleId;
          input.id = "dpgDist-" + roleId + "-" + choice.mm;
          input.value = String(choice.mm);
          input.checked = chosenDistance[roleId] === choice.mm;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            chosenDistance[roleId] = choice.mm;
            refresh();
          });
          const label = document.createElement("label");
          label.setAttribute("for", input.id);
          label.textContent = choice.label;
          wrap.appendChild(input);
          wrap.appendChild(label);
          host.appendChild(wrap);
        });
      }
    );
  }

  function wireControls() {
    const includes = [
      { input: el.includeStatus, key: "status" },
      { input: el.includeTimesroom, key: "timesroom" },
      { input: el.includeCode, key: "code" },
      { input: el.includeTitle, key: "title" },
    ];
    includes.forEach((entry) => {
      entry.input.addEventListener("change", () => {
        included[entry.key] = entry.input.checked;
        refresh();
      });
    });

    [el.contentTimes, el.contentRoom, el.contentCode, el.contentTitle].forEach(
      (input) => {
        input.addEventListener("input", () => {
          refresh();
        });
      }
    );

    window.addEventListener("resize", () => {
      fitFrame();
      refresh();
    });
  }

  /* ------------------------------------------------------------------
     Coverage - the studio's ?coverage=1 pattern. The guide has no
     hidden views; opening every disclosure is the whole of it.
     ------------------------------------------------------------------ */
  const COVERAGE_PARAM = "coverage";

  function coverageRequested() {
    try {
      return new URLSearchParams(window.location.search).has(
        COVERAGE_PARAM
      );
    } catch (error) {
      logError("The coverage flag could not be read from the URL", error);
      return false;
    }
  }

  function applyCoverageState() {
    Array.prototype.forEach.call(
      document.querySelectorAll("details"),
      (disclosure) => {
        disclosure.open = true;
      }
    );
    logInfo(
      "Coverage mode: every disclosure opened. " +
        "This is a diagnostic state, not the shipped one."
    );
  }

  /* ------------------------------------------------------------------
     Boot.
     ------------------------------------------------------------------ */
  function init() {
    if (typeof chroma === "undefined" || !S) {
      document.getElementById("dpgEngineWarning").hidden = false;
      logError(
        "The engine or chroma.js is absent - the guide cannot measure"
      );
      return;
    }

    el.panel = document.getElementById("dpgPanel");
    el.surface = document.getElementById("dpgSurface");
    el.body = document.getElementById("dpgBody");
    el.badgeLine = document.getElementById("dpgBadgeLine");
    el.timesRoomLine = document.getElementById("dpgTimesRoomLine");
    el.codeLine = document.getElementById("dpgCodeLine");
    el.titleLine = document.getElementById("dpgTitleLine");
    el.scaleNote = document.getElementById("dpgScaleNote");
    el.meterFill = document.getElementById("dpgMeterFill");
    el.budgetSentence = document.getElementById("dpgBudgetSentence");
    el.live = document.getElementById("dpgLive");
    el.checksReport = document.getElementById("dpgChecksReport");
    el.includeStatus = document.getElementById("dpgIncludeStatus");
    el.includeTimesroom = document.getElementById("dpgIncludeTimesroom");
    el.includeCode = document.getElementById("dpgIncludeCode");
    el.includeTitle = document.getElementById("dpgIncludeTitle");
    el.contentTimes = document.getElementById("dpgContentTimes");
    el.contentRoom = document.getElementById("dpgContentRoom");
    el.contentCode = document.getElementById("dpgContentCode");
    el.contentTitle = document.getElementById("dpgContentTitle");
    el.derivedStatus = document.getElementById("dpgDerivedStatus");
    el.derivedTimes = document.getElementById("dpgDerivedTimes");
    el.derivedRoom = document.getElementById("dpgDerivedRoom");
    el.derivedCode = document.getElementById("dpgDerivedCode");
    el.derivedTitle = document.getElementById("dpgDerivedTitle");
    el.derivedDatetime = document.getElementById("dpgDerivedDatetime");
    el.stateRadios = document.getElementById("dpgStateRadios");
    el.schemeRadios = document.getElementById("dpgSchemeRadios");
    el.designCvd = document.getElementById("dpgDesignCvd");
    el.designGrey = document.getElementById("dpgDesignGrey");
    el.poolCount = document.getElementById("dpgPoolCount");

    engineState = buildEngineState();
    // The distance choices must reach the caps BEFORE the pool is
    // built: the word's gate is chosen by its rendered cap height, and
    // the recorded 22-of-45 pool is measured at the recommended 14 mm
    // status word. Built from as-built caps alone it reads 12 - the
    // pool checks caught exactly that ordering fault on first run.
    applyChoices(engineState);
    chipPool = buildChipPool();
    el.poolCount.textContent = String(chipPool.length);
    buildDistanceRadios();
    buildStateRadios();
    buildSchemeRadios();
    buildChips();
    wireDesignFor();
    wireControls();
    fitFrame();
    refresh();

    // The canary runs at load, before anyone has touched anything, so
    // its ALLOW state IS the state on screen and its restoration is
    // provable against it. The colour checks follow in the same table.
    renderChecksReport(runFitCanary().concat(runColourChecks()));

    if (coverageRequested()) applyCoverageState();

    // Announcements arm only now: the page reporting its own opening
    // state is load chatter, not news.
    announceEnabled = true;

    logInfo("Door Panel Guide ready");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Exposed for console checking, the studio's pattern.
  window.DoorPanelGuide = {
    refresh: refresh,
    runFitCanary: runFitCanary,
    runColourChecks: runColourChecks,
    getState: () => engineState,
    getLastBudget: () => lastBudget,
    getChipPool: () => chipPool,
    chosenDistance: chosenDistance,
    included: included,
    DISTANCE_CHOICES: DISTANCE_CHOICES,
  };
})();
