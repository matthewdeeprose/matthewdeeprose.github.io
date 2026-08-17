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

  // The "See it as" choices: the panel through each simulated way of
  // seeing. The first is no simulation at all.
  const SIMULATION_CHOICES = Object.freeze([
    Object.freeze({ id: "none", label: "My own eyes - no simulation" }),
    Object.freeze({ id: "protanopia", label: MODE_WORDS.protanopia }),
    Object.freeze({ id: "deuteranopia", label: MODE_WORDS.deuteranopia }),
    Object.freeze({ id: "tritanopia", label: MODE_WORDS.tritanopia }),
    Object.freeze({ id: "greyscale", label: "Greyscale" }),
  ]);

  // The evidence-pattern hand-off: the guide's OWN key, so the studio's
  // payload and this one can never collide.
  const REPORT_PAYLOAD_KEY = "dpg-report-payload";

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

  /* ------------------------------------------------------------------
     IMPORTANCE ORDER AND AUTOMATIC BALANCING (iteration G5).

     THE BALANCE RULE, deterministic: the rank template below is
     assigned in rank order to the INCLUDED, UNPINNED items - excluded
     items take no rung, pinned items keep their hand-picked value and
     consume no rung. The default order reproduces DISTANCE_DEFAULTS
     member for member (the anchor check), so the fit canary's ALLOW
     state is unchanged by construction. Rebalancing is a PURE
     re-derivation from (order, pins, includes, content): it always
     starts from the template and then demotes to fit, so it has no
     memory - shortening a title promotes everything straight back.
     ------------------------------------------------------------------ */
  const RANK_TEMPLATE = Object.freeze([1400, 1000, 700, 700, 600, 600]);

  const ORDER_ITEMS = Object.freeze([
    Object.freeze({ id: "status-text", label: "Status word" }),
    Object.freeze({ id: "room", label: "Room name" }),
    Object.freeze({ id: "times", label: "Times" }),
    Object.freeze({ id: "title", label: "Booking title" }),
    Object.freeze({ id: "code", label: "Course code" }),
    Object.freeze({ id: "clock", label: "Clock and date" }),
  ]);

  const ORDINAL_WORDS = Object.freeze([
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
  ]);

  let importanceOrder = ORDER_ITEMS.map((item) => item.id);

  const pinned = {
    "status-text": false,
    room: false,
    times: false,
    title: false,
    code: false,
    clock: false,
  };

  const el = {};
  let engineState = null;
  let frameHeightPx = 0;
  let lastBudget = null;
  let announceEnabled = false;
  let lastAnnounced = "";
  let chipPool = [];
  let lastPayload = null;

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

  // While a rebalance settles, the budget sentence can pass through
  // transient states (overflow, then fits again after a demotion) -
  // one event, several would-be writes. Suspended, the sentence still
  // updates on screen and lastBudgetSentence still tracks it; only the
  // region write is held back, and runBalancedEvent speaks ONCE at the
  // end.
  let budgetAnnounceSuspended = false;

  function renderBudget(budget) {
    const sentence = budgetSentence(budget);
    el.budgetSentence.textContent = sentence;
    el.budgetSentence.classList.toggle("dpg-budget-over", !budget.ok);
    el.meterFill.style.width = Math.min(100, budget.percent) + "%";
    el.meterFill.classList.toggle("dpg-meter-over", !budget.ok);
    if (sentence !== lastBudgetSentence) {
      lastBudgetSentence = sentence;
      if (!budgetAnnounceSuspended) announceVerdict(sentence);
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
     The balance machinery.
     ------------------------------------------------------------------ */
  function orderLabelFor(roleId) {
    return ORDER_ITEMS.filter((item) => item.id === roleId)[0].label;
  }

  function itemIncludedInPanel(roleId) {
    if (roleId === "status-text") return included.status;
    if (roleId === "times" || roleId === "room") return included.timesroom;
    if (roleId === "code") return included.code;
    if (roleId === "title") return included.title;
    return true; // the clock and date are always on
  }

  /** Template rungs, in rank order, to the included unpinned items. */
  function computeTemplateAssignment() {
    const assignment = {};
    let rung = 0;
    importanceOrder.forEach((roleId) => {
      if (!itemIncludedInPanel(roleId)) return;
      if (pinned[roleId]) return;
      assignment[roleId] =
        RANK_TEMPLATE[Math.min(rung, RANK_TEMPLATE.length - 1)];
      rung += 1;
    });
    return assignment;
  }

  /**
   * DEMOTE-TO-FIT. While the budget overflows, step the LOWEST-ranked
   * automatic item down one rung and re-measure, working upward. The
   * first automatic item - the holder of the 1400 rung - is never
   * demoted: the most important thing keeping the biggest letters is
   * the promise of the feature. Pinned items are never touched. If
   * nothing automatic can step down any further, the ordinary overflow
   * sentence and its levers take over unchanged.
   */
  function rebalance() {
    const assignment = computeTemplateAssignment();
    Object.keys(assignment).forEach((roleId) => {
      chosenDistance[roleId] = assignment[roleId];
    });
    refresh();

    const rungs = DISTANCE_CHOICES.map((choice) => choice.mm);
    let guard = 0;
    while (!lastBudget.fits && guard < 24) {
      guard += 1;
      const autoIds = importanceOrder.filter(
        (roleId) => itemIncludedInPanel(roleId) && !pinned[roleId]
      );
      let stepped = false;
      // From the bottom of the ranking upward, never index 0.
      for (let i = autoIds.length - 1; i >= 1; i -= 1) {
        const roleId = autoIds[i];
        const index = rungs.indexOf(chosenDistance[roleId]);
        if (index > 0) {
          chosenDistance[roleId] = rungs[index - 1];
          stepped = true;
          break;
        }
      }
      if (!stepped) break;
      refresh();
    }
  }

  /**
   * One user event, one settled rebalance, AT MOST one region write.
   * A move passes its own sentence; the verdict joins that same write
   * only when the settle changed it. Eventless changes (radio pins,
   * include toggles, typing, reset) speak only through the verdict,
   * and only when it changed.
   */
  function runBalancedEvent(moveSentence) {
    const beforeSentence = lastBudgetSentence;
    budgetAnnounceSuspended = true;
    try {
      rebalance();
    } finally {
      budgetAnnounceSuspended = false;
    }
    const verdictChanged = lastBudgetSentence !== beforeSentence;
    if (moveSentence) {
      announceVerdict(
        moveSentence + (verdictChanged ? " " + lastBudgetSentence : "")
      );
    } else if (verdictChanged) {
      announceVerdict(lastBudgetSentence);
    }
  }

  /* ------------------------------------------------------------------
     The importance list UI. Rebuilt after every change; focus put back
     on the same logical button, which travels with its item (or its
     sibling when the item has just reached an end and that button is
     now disabled - a disabled control cannot take focus).
     ------------------------------------------------------------------ */
  function moveItem(roleId, delta, direction) {
    const from = importanceOrder.indexOf(roleId);
    const to = from + delta;
    if (to < 0 || to >= importanceOrder.length) return;
    importanceOrder.splice(from, 1);
    importanceOrder.splice(to, 0, roleId);
    runBalancedEvent(
      orderLabelFor(roleId) + " is now " + ORDINAL_WORDS[to] + "."
    );
    renderOrderList();
    const wanted = document.getElementById(
      "dpgOrder" + direction + "-" + roleId
    );
    const sibling = document.getElementById(
      "dpgOrder" + (direction === "Up" ? "Down" : "Up") + "-" + roleId
    );
    if (wanted && !wanted.disabled) {
      wanted.focus();
    } else if (sibling && !sibling.disabled) {
      sibling.focus();
    }
  }

  function renderOrderList() {
    el.orderList.textContent = "";
    importanceOrder.forEach((roleId, index) => {
      const item = document.createElement("li");

      const name = document.createElement("span");
      name.className = "dpg-ordername";
      name.textContent = orderLabelFor(roleId);
      if (!itemIncludedInPanel(roleId)) {
        const note = document.createElement("span");
        note.className = "dpg-ordernote";
        note.textContent = " (not shown on this panel)";
        name.appendChild(note);
      }
      item.appendChild(name);

      [
        { word: "Up", delta: -1, disabled: index === 0 },
        {
          word: "Down",
          delta: 1,
          disabled: index === importanceOrder.length - 1,
        },
      ].forEach((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.id = "dpgOrder" + entry.word + "-" + roleId;
        button.disabled = entry.disabled;
        button.appendChild(
          document.createTextNode("Move " + entry.word.toLowerCase())
        );
        const hidden = document.createElement("span");
        hidden.className = "dps-visually-hidden";
        hidden.textContent = ", " + orderLabelFor(roleId).toLowerCase();
        button.appendChild(hidden);
        button.addEventListener("click", () => {
          moveItem(roleId, entry.delta, entry.word);
        });
        item.appendChild(button);
      });

      el.orderList.appendChild(item);
    });
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

  function sizingTailFor(roleId) {
    return pinned[roleId]
      ? " You chose this size yourself."
      : " Sized automatically from your order.";
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
        "." +
        sizingTailFor(roleId)
      );
    }
    return (
      "Capitals " +
      roundedMm(cap) +
      " mm tall - readable from about " +
      distanceWords(chosenMm) +
      "." +
      sizingTailFor(roleId)
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
     THE DIVIDER AND THE FOOTER BAR (iteration G6). Both are graphical
     roles: no word sits on them, so gateFor's graphical test - 3:1 AND
     Lc 45 against the page - is the whole question, and availabilityFor
     over that same gate is the pool. The two share the page surface,
     so one pool serves both.
     ------------------------------------------------------------------ */
  const FURNITURE_ITEMS = Object.freeze([
    Object.freeze({ id: "divider", label: "Divider line" }),
    Object.freeze({ id: "footer-bar", label: "Footer bar" }),
  ]);

  // The recorded filled pool (programme background: 26 of 45 clear the
  // graphical gate against the page), and a colour that must be
  // refused - University Blue is dark on the dark page.
  const RECORDED_GRAPHICAL_POOL_COUNT = 26;
  const DENY_GRAPHICAL_HEX = "#005c84";

  let furniturePool = [];

  function buildFurniturePool() {
    const role = S.Model.roleById("divider");
    return engineState.palette
      .filter(
        (colour) =>
          S.availabilityFor(role, colour.hex, engineState).available
      )
      .map((colour) => ({ name: colour.name, hex: colour.hex }));
  }

  function furnitureLabelFor(roleId) {
    return roleId === "divider" ? "The divider line" : "The footer bar";
  }

  function furnitureSentence(roleId, derived) {
    const record = derived.byId[roleId];
    const onPage = record.surfaces[0];
    const gate = record.gate;
    const passes = onPage.passesWcag && onPage.passesApca;
    return (
      furnitureLabelFor(roleId) +
      " against the page: " +
      onPage.wcag +
      ":1, Lc " +
      onPage.lc +
      ". Its test is " +
      gate.wcag +
      ":1 and Lc " +
      gate.lc +
      " - " +
      (passes ? "it clears it." : "it MISSES it.") +
      " No word sits on it, so that is the whole test."
    );
  }

  function renderFurnitureRatings(derived) {
    FURNITURE_ITEMS.forEach((item) => {
      const host = document.getElementById("dpgRating-" + item.id);
      if (!host) return;
      host.textContent = furnitureSentence(item.id, derived);
    });
  }

  function buildFurnitureChips() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-furniture-chips]"),
      (host) => {
        const roleId = host.getAttribute("data-furniture-chips");
        furniturePool.forEach((colour) => {
          const wrap = document.createElement("div");
          const input = document.createElement("input");
          input.type = "radio";
          input.name = "dpgFChip-" + roleId;
          input.id =
            "dpgFChip-" + roleId + "-" + colour.hex.replace("#", "");
          input.value = colour.hex;
          input.addEventListener("change", () => {
            if (!input.checked) return;
            // A strip of colour cannot move the fit verdict, so this
            // event has nothing to announce; the radio speaks for
            // itself and the rating sentence updates in place.
            engineState.colours[roleId] = colour.hex;
            refresh();
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

  function syncFurnitureChips() {
    FURNITURE_ITEMS.forEach((item) => {
      const hex = engineState.colours[item.id];
      Array.prototype.forEach.call(
        document.querySelectorAll(
          'input[name="dpgFChip-' + item.id + '"]'
        ),
        (input) => {
          input.checked =
            input.value.toLowerCase() === String(hex).toLowerCase();
        }
      );
    });
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

  function buildSimulationRadios() {
    SIMULATION_CHOICES.forEach((choice) => {
      const wrap = document.createElement("div");
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "dpgSeeItAs";
      input.id = "dpgSeeItAs-" + choice.id;
      input.value = choice.id;
      input.checked = engineState.simulation === choice.id;
      input.addEventListener("change", () => {
        if (!input.checked) return;
        engineState.simulation = choice.id;
        // A visual filter; the radio announces itself and no
        // measurement changes, so nothing else speaks - the same
        // arrangement as the state radios.
        refresh();
      });
      const label = document.createElement("label");
      label.setAttribute("for", input.id);
      label.textContent = choice.label;
      wrap.appendChild(input);
      wrap.appendChild(label);
      el.simulationRadios.appendChild(wrap);
    });
  }

  /* ------------------------------------------------------------------
     STEP 3: THE SCORECARD AND ITS EXPORT.

     ONE DERIVATION FEEDS EVERYTHING. buildReportPayload collects its
     sentences from the very functions the live page renders with -
     derivedSentenceFor for sizes, ratingSentences for colours,
     budgetSentence for the fit - so the scorecard, the export and the
     on-page ratings cannot disagree: they are the same strings from
     the same derive() pass. The payload carries no timestamp, so the
     same choices produce the same bytes on every build (the round-trip
     stability the programme's evidence pattern asks for). The report
     page renders the payload and computes nothing.
     ------------------------------------------------------------------ */
  function buildReportPayload(derived, budget, readability) {
    const st = engineState;
    const statusWordContent = S.Model.STATUSES.map((status) =>
      wordingFor(status.id)
    ).join(" / ");

    const lines = [
      {
        name: "Status word",
        included: included.status,
        content: statusWordContent + " (changes with the room)",
        readFrom: distanceWords(chosenDistance["status-text"]),
        sizeSentence: derivedSentenceFor("status-text", derived),
      },
      {
        name: "Times and room name",
        included: included.timesroom,
        content: st.content.times + " " + st.content.room,
        readFrom:
          distanceWords(chosenDistance.times) +
          " (times), " +
          distanceWords(chosenDistance.room) +
          " (room name)",
        sizeSentence:
          "Times: " +
          derivedSentenceFor("times", derived) +
          " Room name: " +
          derivedSentenceFor("room", derived),
      },
      {
        name: "Course code",
        included: included.code,
        content: st.content.code,
        readFrom: distanceWords(chosenDistance.code),
        sizeSentence: derivedSentenceFor("code", derived),
      },
      {
        name: "Booking title",
        included: included.title,
        content: st.content.title,
        readFrom: distanceWords(chosenDistance.title),
        sizeSentence: derivedSentenceFor("title", derived),
      },
      {
        name: "Clock and date",
        included: true,
        content: st.content.clock + ", " + st.content.date,
        readFrom: distanceWords(chosenDistance.clock),
        sizeSentence: derivedSentenceFor("clock", derived),
      },
      {
        name: "University logo",
        included: true,
        content: "The logo, at the size the panel was built with",
        readFrom: "-",
        sizeSentence: "A picture, not text - it has no reading distance.",
      },
    ];

    return {
      kind: "door-panel-guide-report",
      title: "Door panel design report",
      intro:
        "Built with the Door Panel Guide. Every figure was measured in the browser at the moment the choices were made; this report renders those measurements and computes nothing.",
      panelSentence:
        "The panel is " +
        st.geometry.panelWmm +
        " by " +
        st.geometry.panelHmm +
        " mm. Letter sizes follow one rule: reading distance in millimetres, divided by 100.",
      designForSentence:
        "The closest-pair figures count " +
        S.bindingSetLabel(st) +
        ". Everything is measured in every way of seeing whatever is ticked.",
      orderIntro:
        "The lines in order of importance. The most important gets the biggest letters; sizes marked automatic were balanced from this order.",
      order: importanceOrder.map((roleId) => ({
        name: orderLabelFor(roleId),
        shown: itemIncludedInPanel(roleId),
        sized: pinned[roleId] ? "hand-picked" : "automatic",
      })),
      lines: lines,
      statuses: S.Model.STATUSES.map((status) => ({
        wording: wordingFor(status.id),
        colourName: paletteNameFor(
          st.colours["status-fill-" + status.id]
        ),
        hex: st.colours["status-fill-" + status.id],
        sentences: ratingSentences(status.id, derived),
      })),
      fitSentence: budgetSentence(budget),
      furniture: FURNITURE_ITEMS.map((item) => ({
        name: item.label,
        colourName: paletteNameFor(st.colours[item.id]),
        hex: st.colours[item.id],
        sentence: furnitureSentence(item.id, derived),
      })),
      readability: readability || [],
      readabilityNote: READABILITY_NOTE,
      honesty:
        "A clean set of figures here is not WCAG conformance. It is the set of measurements this guide makes, honestly reported.",
    };
  }

  function renderScorecard(payload) {
    const host = el.scorecard;
    host.textContent = "";

    const orderHeading = document.createElement("h4");
    orderHeading.textContent = "Order of importance";
    host.appendChild(orderHeading);
    const orderIntro = document.createElement("p");
    orderIntro.className = "dps-hint";
    orderIntro.textContent = payload.orderIntro;
    host.appendChild(orderIntro);
    const orderList = document.createElement("ol");
    payload.order.forEach((entry) => {
      const item = document.createElement("li");
      item.textContent =
        entry.name +
        " - " +
        entry.sized +
        (entry.shown ? "" : " (not shown on this panel)");
      orderList.appendChild(item);
    });
    host.appendChild(orderList);

    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = "What the panel says";
    table.appendChild(caption);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Line", "Words", "Read from", "Letter size"].forEach((text) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    payload.lines.forEach((line) => {
      const row = document.createElement("tr");
      const cells = line.included
        ? [line.name, line.content, line.readFrom, line.sizeSentence]
        : [line.name, "Not shown on this panel", "-", "-"];
      cells.forEach((text, index) => {
        const cell = document.createElement(index === 0 ? "th" : "td");
        if (index === 0) cell.scope = "row";
        cell.textContent = text;
        row.appendChild(cell);
      });
      body.appendChild(row);
    });
    table.appendChild(body);
    host.appendChild(table);

    const coloursHeading = document.createElement("h4");
    coloursHeading.textContent = "The colours, measured";
    host.appendChild(coloursHeading);
    payload.statuses.forEach((status) => {
      const block = document.createElement("div");
      const name = document.createElement("p");
      const swatch = document.createElement("span");
      swatch.className = "dpg-swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.background = status.hex;
      name.appendChild(swatch);
      name.appendChild(
        document.createTextNode(
          " " + status.wording + ": " + status.colourName
        )
      );
      name.style.fontWeight = "600";
      block.appendChild(name);
      status.sentences.forEach((sentence) => {
        const line = document.createElement("p");
        line.className = "dps-hint";
        line.textContent = sentence;
        block.appendChild(line);
      });
      host.appendChild(block);
    });

    const furnitureHeading = document.createElement("h4");
    furnitureHeading.textContent = "The divider and the footer bar";
    host.appendChild(furnitureHeading);
    payload.furniture.forEach((entry) => {
      const block = document.createElement("div");
      const name = document.createElement("p");
      const swatch = document.createElement("span");
      swatch.className = "dpg-swatch";
      swatch.setAttribute("aria-hidden", "true");
      swatch.style.background = entry.hex;
      name.appendChild(swatch);
      name.appendChild(
        document.createTextNode(" " + entry.name + ": " + entry.colourName)
      );
      name.style.fontWeight = "600";
      block.appendChild(name);
      const line = document.createElement("p");
      line.className = "dps-hint";
      line.textContent = entry.sentence;
      block.appendChild(line);
      host.appendChild(block);
    });

    const fitHeading = document.createElement("h4");
    fitHeading.textContent = "Does it fit?";
    host.appendChild(fitHeading);
    [payload.fitSentence, payload.designForSentence, payload.honesty].forEach(
      (text) => {
        const line = document.createElement("p");
        line.textContent = text;
        host.appendChild(line);
      }
    );
  }

  function wireReportLink() {
    el.reportLink.addEventListener("click", () => {
      try {
        window.localStorage.setItem(
          REPORT_PAYLOAD_KEY,
          JSON.stringify(lastPayload)
        );
      } catch (error) {
        // The link still navigates; the report page says plainly that
        // it has nothing to show.
        logError("The report payload could not be stored", error);
      }
    });
  }

  /* ------------------------------------------------------------------
     READABILITY - informational, instrument stated. The studio's
     iteration 12 instrument: Flesch-Kincaid grade plus five for a
     reading age, syllables counted as vowel groups, measured on the
     section's own visible text. Control labels and figures are counted
     with the prose, which pushes the number up; the note says so.
     ------------------------------------------------------------------ */
  const READABILITY_NOTE =
    "Reading age is Flesch-Kincaid grade plus five, with syllables counted as vowel groups, measured on each section's visible text including its control labels and figures (which push the number up). A rough instrument, reported for information; Matthew's read is the real gate.";

  function syllablesIn(word) {
    const groups = word.toLowerCase().match(/[aeiouy]+/g);
    return groups ? groups.length : 1;
  }

  function readingAgeOf(text) {
    const words = (text.match(/[A-Za-z0-9']+/g) || []).filter(
      (word) => /[a-z]/i.test(word)
    );
    const sentences = Math.max(
      1,
      (text.match(/[.!?]+(?=\s|$)/g) || []).length
    );
    if (!words.length) return null;
    const syllables = words.reduce(
      (total, word) => total + syllablesIn(word),
      0
    );
    const grade =
      0.39 * (words.length / sentences) +
      11.8 * (syllables / words.length) -
      15.59;
    return {
      words: words.length,
      sentences: sentences,
      readingAge: Math.round((grade + 5) * 10) / 10,
    };
  }

  function sectionTextBetween(fromId, toId) {
    const start = document.getElementById(fromId);
    const end = toId ? document.getElementById(toId) : null;
    const parts = [];
    let node = start;
    while (node && node !== end) {
      // The checks disclosure is diagnostics, not the journey's prose.
      if (!node.classList || !node.classList.contains("dpg-checks")) {
        parts.push(node.innerText || "");
      }
      node = node.nextElementSibling;
    }
    return parts.join(" ");
  }

  function readabilityRows() {
    const sections = [
      { name: "Step 1 - lines", from: "dpg-step1", to: "dpg-step2" },
      { name: "Step 2 - colours", from: "dpg-step2", to: "dpg-step3" },
      { name: "Step 3 - result", from: "dpg-step3", to: null },
    ];
    return sections.map((section) => {
      const measured = readingAgeOf(
        sectionTextBetween(section.from, section.to)
      );
      return {
        section: section.name,
        words: measured ? measured.words : 0,
        readingAge: measured ? measured.readingAge : null,
      };
    });
  }

  function renderReadability(rows) {
    const host = el.readability;
    host.textContent = "";
    const table = document.createElement("table");
    const caption = document.createElement("caption");
    caption.textContent = "Readability, for information - nothing gates on it";
    table.appendChild(caption);
    const head = document.createElement("thead");
    const headRow = document.createElement("tr");
    ["Section", "Words", "Reading age"].forEach((text) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = text;
      headRow.appendChild(th);
    });
    head.appendChild(headRow);
    table.appendChild(head);
    const body = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      [row.section, String(row.words), String(row.readingAge)].forEach(
        (text, index) => {
          const cell = document.createElement(index === 0 ? "th" : "td");
          if (index === 0) cell.scope = "row";
          cell.textContent = text;
          tr.appendChild(cell);
        }
      );
      body.appendChild(tr);
    });
    table.appendChild(body);
    host.appendChild(table);
    const note = document.createElement("p");
    note.className = "dps-hint";
    note.textContent = READABILITY_NOTE;
    host.appendChild(note);
  }

  /* ------------------------------------------------------------------
     Report checks: the by-construction claims, asserted anyway.
     ------------------------------------------------------------------ */
  function runReportChecks() {
    const rows = [];

    // Two separate derivations must produce byte-identical payloads -
    // the round-trip stability the evidence pattern asks for. The
    // measured readability is passed in, the same as the live payload
    // carries, so the comparison covers the whole object.
    const first = JSON.stringify(
      buildReportPayload(
        S.derive(engineState),
        lastBudget,
        lastPayload.readability
      )
    );
    const second = JSON.stringify(
      buildReportPayload(
        S.derive(engineState),
        lastBudget,
        lastPayload.readability
      )
    );
    rows.push({
      label:
        "The report payload is byte-identical across two separate derivations (no timestamp, no drift)",
      expected: first.length + " bytes, twice",
      actual:
        second.length +
        " bytes, " +
        (first === second ? "identical" : "DIFFERENT"),
      agrees: first === second,
    });

    // The scorecard's colour sentences ARE step 2's rating lines.
    let sentencesMatch = true;
    S.Model.STATUSES.forEach((status, index) => {
      const onCard = Array.prototype.map.call(
        document.querySelectorAll(
          "#dpgRatings-" + status.id + " p"
        ),
        (line) => line.textContent
      );
      const onScorecard = lastPayload.statuses[index].sentences;
      if (onCard.join("|") !== onScorecard.join("|")) {
        sentencesMatch = false;
      }
    });
    rows.push({
      label:
        "The scorecard's colour sentences are step 2's rating lines, string for string (one derivation feeds both)",
      expected: "identical",
      actual: sentencesMatch ? "identical" : "DIFFERENT",
      agrees: sentencesMatch,
    });

    rows.push({
      label: "The scorecard's fit sentence is the meter's sentence",
      expected: "identical",
      actual:
        lastPayload.fitSentence === el.budgetSentence.textContent
          ? "identical"
          : "DIFFERENT",
      agrees: lastPayload.fitSentence === el.budgetSentence.textContent,
    });

    return rows;
  }

  /* ------------------------------------------------------------------
     ORDER CHECKS - the balance rule's own DENY/ALLOW set, run on the
     live page and put back exactly, like the fit canary.
     ------------------------------------------------------------------ */
  function runOrderChecks() {
    const rows = [];
    const savedOrder = importanceOrder.slice();
    const savedPins = Object.assign({}, pinned);
    const savedDistances = Object.assign({}, chosenDistance);
    const savedIncluded = Object.assign({}, included);
    const before = refresh();
    const beforeSentence = budgetSentence(before.budget);
    budgetAnnounceSuspended = true;

    try {
      // ALLOW, the anchor: default order, no pins, everything on -
      // the template must reproduce DISTANCE_DEFAULTS member for
      // member, which is what keeps the fit canary's ALLOW state
      // unchanged by construction.
      importanceOrder = ORDER_ITEMS.map((item) => item.id);
      Object.keys(pinned).forEach((key) => {
        pinned[key] = false;
      });
      Object.keys(included).forEach((key) => {
        included[key] = true;
      });
      const anchor = computeTemplateAssignment();
      const anchorKeys = Object.keys(DISTANCE_DEFAULTS);
      const anchorMisses = anchorKeys.filter(
        (key) => anchor[key] !== DISTANCE_DEFAULTS[key]
      );
      rows.push({
        label:
          "ANCHOR: the default order reproduces the distance defaults member for member",
        expected: anchorKeys.length + " of " + anchorKeys.length + " match",
        actual:
          anchorKeys.length -
          anchorMisses.length +
          " of " +
          anchorKeys.length +
          " match" +
          (anchorMisses.length ? " (missing: " + anchorMisses.join(", ") + ")" : ""),
        agrees: anchorMisses.length === 0,
      });

      // ALLOW: one reorder moves the assignments as the template says.
      importanceOrder = [
        "title",
        "status-text",
        "room",
        "times",
        "code",
        "clock",
      ];
      const reordered = computeTemplateAssignment();
      const reorderExpected = {
        title: 1400,
        "status-text": 1000,
        room: 700,
        times: 700,
        code: 600,
        clock: 600,
      };
      const reorderMisses = Object.keys(reorderExpected).filter(
        (key) => reordered[key] !== reorderExpected[key]
      );
      rows.push({
        label:
          "Reorder: booking title moved first takes 1400 and the rest shift down the template",
        expected: "6 of 6 match",
        actual:
          6 - reorderMisses.length +
          " of 6 match" +
          (reorderMisses.length ? " (" + reorderMisses.join(", ") + ")" : ""),
        agrees: reorderMisses.length === 0,
      });

      // DENY, the demote fixture: that title-first order overflows at
      // the plain template (positive premise), and the settle demotes
      // the LOWEST-ranked automatic item first while rank 1 holds
      // 1400.
      Object.keys(reordered).forEach((roleId) => {
        chosenDistance[roleId] = reordered[roleId];
      });
      refresh();
      const overflowedAtTemplate = !lastBudget.fits;
      rebalance();
      rows.push({
        label:
          "DENY premise: the title-first template overflows before the settle (a fixture that cannot go red proves nothing)",
        expected: "overflows",
        actual: overflowedAtTemplate ? "overflows" : "FITS",
        agrees: overflowedAtTemplate,
      });
      rows.push({
        label:
          "Demote-to-fit: rank 1 (booking title) never leaves 1400 through the settle",
        expected: "1400 mm",
        actual: chosenDistance.title + " mm",
        agrees: chosenDistance.title === 1400,
      });
      rows.push({
        label:
          "Demote-to-fit: the lowest-ranked automatic item that could step down (times) was demoted",
        expected: "600 mm",
        actual: chosenDistance.times + " mm",
        agrees: chosenDistance.times === 600,
      });

      // Pin survival: a hand-picked size rides out a rebalance that
      // moves its neighbours.
      importanceOrder = ORDER_ITEMS.map((item) => item.id);
      Object.keys(pinned).forEach((key) => {
        pinned[key] = false;
      });
      pinned.code = true;
      chosenDistance.code = 1000;
      importanceOrder = [
        "room",
        "status-text",
        "times",
        "title",
        "code",
        "clock",
      ];
      rebalance();
      rows.push({
        label:
          "Pin survival: the course code's hand-picked 1000 survives a rebalance that moved its neighbours",
        expected: "1000 mm, still pinned",
        actual:
          chosenDistance.code +
          " mm, " +
          (pinned.code ? "still pinned" : "UNPINNED"),
        agrees: chosenDistance.code === 1000 && pinned.code === true,
      });

      // Reset: pins cleared, the template restored. Run on the DEFAULT
      // order, whose template fits without any demotion - on an
      // overflowing order the balance rule legitimately demotes after
      // the reset, and this row would be asserting a state the rule
      // never promises (the first run of this check did exactly that,
      // and read 3 misses against a correct settle).
      importanceOrder = ORDER_ITEMS.map((item) => item.id);
      Object.keys(pinned).forEach((key) => {
        pinned[key] = false;
      });
      rebalance();
      const afterReset = computeTemplateAssignment();
      const resetMisses = Object.keys(afterReset).filter(
        (key) => chosenDistance[key] !== afterReset[key]
      );
      const pinsLeft = Object.keys(pinned).filter((key) => pinned[key]);
      rows.push({
        label:
          "Reset: clearing every pin returns every automatic item to its template rung",
        expected: "0 pins, 0 template misses",
        actual:
          pinsLeft.length + " pins, " + resetMisses.length + " misses",
        agrees: pinsLeft.length === 0 && resetMisses.length === 0,
      });
    } finally {
      importanceOrder = savedOrder;
      Object.keys(pinned).forEach((key) => {
        pinned[key] = savedPins[key];
      });
      Object.keys(chosenDistance).forEach((key) => {
        chosenDistance[key] = savedDistances[key];
      });
      Object.keys(included).forEach((key) => {
        included[key] = savedIncluded[key];
      });
      const after = refresh();
      renderOrderList();
      budgetAnnounceSuspended = false;
      rows.push({
        label: "The order checks put the page back exactly as they found it",
        expected: beforeSentence,
        actual: budgetSentence(after.budget),
        agrees: budgetSentence(after.budget) === beforeSentence,
      });
    }
    return rows;
  }

  /* ------------------------------------------------------------------
     FURNITURE CHECKS - the graphical pool's own DENY/ALLOW set.
     ------------------------------------------------------------------ */
  function runFurnitureChecks() {
    const rows = [];
    const st = engineState;

    rows.push({
      label:
        "The divider/footer pool matches the recorded graphical pool (3:1 and Lc 45 against the page)",
      expected:
        RECORDED_GRAPHICAL_POOL_COUNT + " of " + RECORDED_PALETTE_COUNT,
      actual: furniturePool.length + " of " + st.palette.length,
      agrees:
        furniturePool.length === RECORDED_GRAPHICAL_POOL_COUNT &&
        st.palette.length === RECORDED_PALETTE_COUNT,
    });

    const denyAdmitted = furniturePool.some(
      (colour) => colour.hex.toLowerCase() === DENY_GRAPHICAL_HEX
    );
    rows.push({
      label:
        "DENY: University Blue is refused by the divider/footer pool - dark on the dark page",
      expected: "refused",
      actual: denyAdmitted ? "ADMITTED" : "refused",
      agrees: !denyAdmitted,
    });

    const dividerDefault = S.Model.roleById("divider").defaultHex;
    const footerDefault = S.Model.roleById("footer-bar").defaultHex;
    const defaultsHeld =
      st.colours.divider.toLowerCase() === dividerDefault.toLowerCase() &&
      st.colours["footer-bar"].toLowerCase() ===
        footerDefault.toLowerCase();
    rows.push({
      label:
        "The default selection reproduces the as-built Digital Blue on both elements",
      expected: dividerDefault + " twice",
      actual: st.colours.divider + ", " + st.colours["footer-bar"],
      agrees: defaultsHeld,
    });

    // The rating line's figures against the instruments themselves,
    // recomputed directly - gap must be exactly zero.
    const derived = S.derive(st);
    let figureMisses = 0;
    FURNITURE_ITEMS.forEach((item) => {
      const record = derived.byId[item.id];
      const direct = S.Engine.contrastPair(
        st.colours[item.id],
        st.colours["page-bg"]
      );
      const gate = S.gateFor(S.Model.roleById(item.id), 0, st);
      if (
        record.surfaces[0].wcag !== direct.wcag ||
        record.surfaces[0].lc !== direct.lc ||
        record.gate.wcag !== gate.wcag ||
        record.gate.lc !== gate.lc
      ) {
        figureMisses += 1;
      }
    });
    rows.push({
      label:
        "The rating figures are gateFor's and contrastPair's own output, gap 0.0 on both elements",
      expected: "0 misses",
      actual: figureMisses + " misses",
      agrees: figureMisses === 0,
    });

    return rows;
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
      simulation: engineState.simulation,
    });
    el.badgeLine.hidden = !included.status;
    el.timesRoomLine.hidden = !included.timesroom;
    el.codeLine.hidden = !included.code;
    el.titleLine.hidden = !included.title;

    lastBudget = computeBudget(derived);
    renderBudget(lastBudget);
    renderDerivedSentences(derived);
    renderRatings(derived);
    renderFurnitureRatings(derived);
    syncColourControls();
    syncFurnitureChips();
    // The balance writes into the radios, so the two views can never
    // disagree: whatever chosenDistance holds is what the radios show.
    syncDistanceRadios();
    // The scorecard and the export payload come from THIS derive pass,
    // through the same sentence functions the blocks above rendered
    // with - one derivation feeding everything. Readability is
    // measured AFTER the scorecard renders, so it counts the page as
    // it now stands: measured before, each payload counted the
    // PREVIOUS refresh's scorecard, and the fit canary's restore pass
    // shipped a payload that had counted the DENY-state scorecard -
    // caught by the export's cross-reload byte-stability drive.
    lastPayload = buildReportPayload(derived, lastBudget, null);
    renderScorecard(lastPayload);
    lastPayload.readability = readabilityRows();
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
  function syncDistanceRadios() {
    Object.keys(chosenDistance).forEach((roleId) => {
      const wanted = String(chosenDistance[roleId]);
      Array.prototype.forEach.call(
        document.querySelectorAll('input[name="dpgDist-' + roleId + '"]'),
        (input) => {
          input.checked = input.value === wanted;
        }
      );
    });
  }

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
            // A hand-picked size sticks: this group is pinned from now
            // on and rebalancing works around it.
            chosenDistance[roleId] = choice.mm;
            pinned[roleId] = true;
            runBalancedEvent(null);
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
        // Includes feed the balance (an excluded line frees its rung),
        // and the list shows the not-shown note in place.
        runBalancedEvent(null);
        renderOrderList();
      });
    });

    [el.contentTimes, el.contentRoom, el.contentCode, el.contentTitle].forEach(
      (input) => {
        input.addEventListener("input", () => {
          // Content moves the fit, so it re-balances too - and because
          // the balance always starts from the template, shortening a
          // line promotes everything straight back.
          runBalancedEvent(null);
        });
      }
    );

    el.orderReset.addEventListener("click", () => {
      Object.keys(pinned).forEach((key) => {
        pinned[key] = false;
      });
      runBalancedEvent(null);
    });

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
    el.simulationRadios = document.getElementById("dpgSimulationRadios");
    el.scorecard = document.getElementById("dpgScorecard");
    el.reportLink = document.getElementById("dpgReportLink");
    el.readability = document.getElementById("dpgReadability");
    el.orderList = document.getElementById("dpgOrderList");
    el.orderReset = document.getElementById("dpgOrderReset");

    engineState = buildEngineState();
    // The "See it as" filters must exist before any simulation is
    // selected; the module builds them once, into this page's body.
    window.ContrastCardsCVD.buildSVGFilters();
    // The distance choices must reach the caps BEFORE the pool is
    // built: the word's gate is chosen by its rendered cap height, and
    // the recorded 22-of-45 pool is measured at the recommended 14 mm
    // status word. Built from as-built caps alone it reads 12 - the
    // pool checks caught exactly that ordering fault on first run.
    applyChoices(engineState);
    chipPool = buildChipPool();
    furniturePool = buildFurniturePool();
    el.poolCount.textContent = String(chipPool.length);
    buildDistanceRadios();
    buildStateRadios();
    buildSchemeRadios();
    buildSimulationRadios();
    buildChips();
    buildFurnitureChips();
    renderOrderList();
    wireDesignFor();
    wireReportLink();
    wireControls();
    fitFrame();
    refresh();

    // The canary runs at load, before anyone has touched anything, so
    // its ALLOW state IS the state on screen and its restoration is
    // provable against it. The colour and report checks follow in the
    // same table; the readability table sits beside it, ungated.
    renderChecksReport(
      runFitCanary()
        .concat(runColourChecks())
        .concat(runReportChecks())
        .concat(runOrderChecks())
        .concat(runFurnitureChecks())
    );
    renderReadability(readabilityRows());

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
    runReportChecks: runReportChecks,
    runOrderChecks: runOrderChecks,
    runFurnitureChecks: runFurnitureChecks,
    getFurniturePool: () => furniturePool,
    getState: () => engineState,
    getLastBudget: () => lastBudget,
    getChipPool: () => chipPool,
    getLastPayload: () => lastPayload,
    getImportanceOrder: () => importanceOrder.slice(),
    getPinned: () => Object.assign({}, pinned),
    readabilityRows: readabilityRows,
    chosenDistance: chosenDistance,
    included: included,
    DISTANCE_CHOICES: DISTANCE_CHOICES,
  };
})();
