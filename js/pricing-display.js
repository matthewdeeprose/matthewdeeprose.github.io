/**
 * js/pricing-display.js
 *
 * ONE implementation of "is this price temporary, and what should we say about it?".
 *
 * OpenRouter runs time-limited promotions and NO API ROUTE EXPOSES WHEN ONE ENDS. A price
 * captured mid-promotion and never re-checked is how qwen/qwen3-30b-a3b-thinking-2507 came to
 * understate its output cost by 8.4x for two months. The registry now records the answer in
 * each entry's `metadata`, and this file turns that record into the words a user reads.
 *
 * WHY IT IS A SEPARATE FILE. Three surfaces show model prices, in three different module
 * styles: the picker and information panel built by js/modules/model-manager.js (an ES module),
 * the filtered picker and panel in js/enhanced-model-selection.js (a plain-script IIFE on
 * window), and the Chat model-information panel in chat/chat-model-info.js (another IIFE). A
 * copy per surface is three chances for the wording to drift apart, and this project exists
 * because one question had two implementations that disagreed. A plain script published on
 * window is reachable by all three: deferred ES modules always run after plain scripts, so the
 * global is present by the time any consumer renders.
 *
 * THE FIGURES ARE LOWER BOUNDS, NEVER FORECASTS. `pricingStandard` is derived from the cheapest
 * undiscounted endpoint rate, so the post-promotion price is AT LEAST that. Nothing here may be
 * phrased as a prediction, and a side that is not promotional is described as "not promotional"
 * rather than as fixed — the listed price is one endpoint tier and can move for other reasons.
 *
 * Publishes window.PricingDisplay. Loads before its consumers; no dependencies.
 */
(function () {
  "use strict";

  // ── Logging configuration ───────────────────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[PricingDisplay]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[PricingDisplay]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[PricingDisplay]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[PricingDisplay]");
      console.log.apply(console, args);
    }
  }

  // ── Constants ───────────────────────────────────────────────────────────

  /**
   * The short marker appended to a picker option. Kept brief on purpose: an option's text is
   * already "Name (provider)" plus an optional cost, and the picker warns past 80 characters.
   * The full explanation belongs in the information panel, where someone is deciding rather
   * than scanning.
   */
  const MARKER = " (promotional price)";

  /** The lead-in on the panel notice, rendered in <strong>. */
  const NOTICE_LEAD = "Promotional price.";

  // ── Per-meter costs, and the unit nobody agreed on ──────────────────────
  //
  // THE DEFECT THIS REPLACES, MEASURED 11 SEPTEMBER 2026. `costs.image` is rendered to users
  // on 36 enabled models, and THREE sources gave it THREE different units: .claude/model-add
  // derives it as dollars per MILLION TOKENS, this app labelled it "per 1K images", and a
  // hand-written comment in the registry called it "per million input images". Tokens are not
  // images, so the label was wrong in KIND, not merely in scale.
  //
  // WORSE, AND THIS IS WHY THE LABEL COULD NOT SIMPLY BE CORRECTED: the field is genuinely
  // MIXED-UNIT. Of its 46 non-zero entries, 10 are $/M tokens matching the live catalogue
  // exactly (all Gemini, where an image token costs the same as a text token) and about 35 are
  // $/1K images written by hand from a vendor price page and having no live counterpart at
  // all. Relabelling to "per 1M tokens" would have broken the 35 that were right; leaving
  // "per 1K images" kept the 10 wrong. NO SINGLE LABEL CAN BE CORRECT FOR THAT FIELD, so the
  // figure is rendered without a unit claim and the absence is stated.
  //
  // The repair going forward is `costs.meters`, where each figure CARRIES its unit, keyed by
  // the catalogue's own meter name. A value with its unit beside it can be rendered honestly
  // without anyone consulting a comment.

  /**
   * The unit strings a `costs.meters` entry may carry, and the words for each.
   *
   * PINNED IN THREE PLACES AND HELD TOGETHER BY A PROOF ROW. The same two strings appear in
   * .claude/model-add/pricing.mjs (METER_UNIT, the capture side) and in
   * js/model-registry/model-registry-validator.js (KNOWN_METER_UNITS, the gate). None of the
   * three can import either of the others — a tool module, a shipped ES module and this plain
   * script — so prove-modality.mjs reads the literals out of all three and reddens when they
   * disagree.
   */
  const METER_UNIT_LABEL = {
    "usd-per-million-tokens": "per 1M tokens",
    "usd-per-request": "per request",
  };

  /** Human names for the meters this app captures. Keyed by the catalogue's own meter name. */
  const METER_LABEL = {
    image: "Image input cost",
    audio: "Audio input cost",
    image_output: "Image output cost",
    audio_output: "Audio output cost",
  };

  /** The sentence shown where a legacy figure has no recorded unit. */
  const UNIT_NOT_RECORDED = "unit not recorded";

  /**
   * The lines to render for a model's unit-tagged meters, in a stable order.
   *
   * Returns [] rather than null for an entry with no meters, because a caller concatenates.
   * A meter whose unit is not in the vocabulary is DROPPED rather than rendered with a guessed
   * label — showing a number under the wrong unit is the defect this whole block replaces.
   *
   * @param {Object} [costs] - a registry entry's costs block
   * @returns {Array<{key: string, label: string, value: number, unitLabel: string, text: string}>}
   */
  function meterLines(costs) {
    const meters = costs && costs.meters;
    if (!meters || typeof meters !== "object") return [];

    const out = [];
    // METER_LABEL's own key order, so two models never present these lines in a different
    // sequence just because the catalogue happened to enumerate them differently.
    for (const key of Object.keys(METER_LABEL)) {
      const meter = meters[key];
      if (!meter || typeof meter.value !== "number" || !isFinite(meter.value)) continue;
      const unitLabel = METER_UNIT_LABEL[meter.unit];
      if (!unitLabel) {
        logWarn("Dropping meter with an unrecognised unit:", key, meter.unit);
        continue;
      }
      out.push({
        key,
        label: METER_LABEL[key],
        value: meter.value,
        unitLabel,
        text: "$" + meter.value.toFixed(3) + " " + unitLabel,
      });
    }
    return out;
  }

  /**
   * The legacy `costs.image` line, or null.
   *
   * Null when the figure is absent, zero, or already superseded by a unit-tagged
   * `costs.meters.image` — rendering both would show one model two image prices.
   *
   * @param {Object} [costs] - a registry entry's costs block
   * @returns {{label: string, text: string}|null}
   */
  function legacyImageLine(costs) {
    if (!costs || typeof costs.image !== "number" || !costs.image) return null;
    if (costs.meters && costs.meters.image) return null;
    return {
      label: "Image cost",
      // NO UNIT IS ASSERTED, on purpose. See the block comment above: this field holds
      // $/M tokens on some entries and $/1K images on others, and the entry itself does not
      // say which. A short honest qualifier beats a wrong number.
      text: "$" + costs.image.toFixed(3) + " (" + UNIT_NOT_RECORDED + ")",
    };
  }

  /**
   * A short sentence saying what the displayed figures do NOT cover, or "".
   *
   * WHY IT IS DRIVEN BY THE DATA AND NOT BY THE MODEL'S CAPABILITIES. The registry records
   * what it has measured; it cannot say what it has not. An entry with no `costs.meters` has
   * had no image or audio rate captured — which is true of every entry written before
   * 11 September 2026 — and saying so is accurate. As entries gain meters at registration the
   * note disappears by itself, with nothing to remember to remove.
   *
   * @param {Object} [costs] - a registry entry's costs block
   * @returns {string}
   */
  function coverageNote(costs) {
    if (!costs) return "";
    if (costs.meters && Object.keys(costs.meters).length > 0) return "";
    return (
      "Input and output costs are for text tokens. No image or audio rate has been recorded " +
      "for this model, so any such charge is not shown here."
    );
  }

  /**
   * The meter lines plus the coverage note as an HTML fragment of <dt>/<dd> pairs, for the
   * consumers that assemble their panel with innerHTML.
   *
   * Only registry numbers and a fixed vocabulary reach the markup — no model-supplied prose —
   * so there is nothing here to escape.
   *
   * @param {Object} [costs] - a registry entry's costs block
   * @returns {string}
   */
  function costLinesHTML(costs) {
    let html = "";
    const legacy = legacyImageLine(costs);
    if (legacy) {
      html +=
        "<dt>" + legacy.label + ":</dt>" +
        '<dd class="modelCostDD"><strong>' + legacy.text + "</strong></dd>";
    }
    for (const line of meterLines(costs)) {
      html +=
        "<dt>" + line.label + ":</dt>" +
        '<dd class="modelCostDD"><strong>' + line.text + "</strong></dd>";
    }
    const note = coverageNote(costs);
    if (note) {
      html += '<dt class="modelCostCoverage">Not shown:</dt>' +
        '<dd class="modelCostDD modelCostCoverage">' + note + "</dd>";
    }
    return html;
  }

  // ── Reading the registry marker ─────────────────────────────────────────

  /**
   * Which side of the price is promotional, or null.
   *
   * NULL RATHER THAN "none", because that is what the registry writes. `pricingStandard` and
   * `pricingPromotionalSides` are emitted together, only for a genuinely promotional entry, and
   * removed together when the promotion ends — so a consumer gets exactly ONE truthy test and
   * cannot accidentally warn about a normally-priced model.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {"input"|"output"|"both"|null}
   */
  function promotionalSides(metadata) {
    return (metadata && metadata.pricingPromotionalSides) || null;
  }

  /**
   * True when this model's displayed price is temporary.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {boolean}
   */
  function isPromotional(metadata) {
    return !!promotionalSides(metadata);
  }

  /**
   * The marker for a picker option — "" when the price is not promotional.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {string}
   */
  function markerFor(metadata) {
    return isPromotional(metadata) ? MARKER : "";
  }

  // ── The sentence ────────────────────────────────────────────────────────

  function formatRate(value) {
    return typeof value === "number" ? "$" + value : "an unpublished rate";
  }

  /**
   * The explanatory sentence for an information panel, WITHOUT the "Promotional price." lead —
   * callers render that themselves, in whatever element suits their markup. Returns "" when the
   * price is not promotional.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {string}
   */
  function describe(metadata) {
    const sides = promotionalSides(metadata);
    if (!sides) return "";

    const standard = metadata.pricingStandard || {};
    let body;

    if (sides === "both") {
      body =
        " When this promotion ends, the input cost rises to at least " +
        formatRate(standard.input) +
        " and the output cost to at least " +
        formatRate(standard.output) +
        " per 1M tokens.";
    } else {
      // One side only. The other is "not promotional", never "fixed".
      const which = sides === "output" ? "output" : "input";
      const other = which === "output" ? "input" : "output";
      const value = which === "output" ? standard.output : standard.input;
      body =
        " When this promotion ends, the " +
        which +
        " cost rises to at least " +
        formatRate(value) +
        " per 1M tokens. The " +
        other +
        " cost is not promotional.";
    }

    // The honesty clause, and it is not decoration. No published route gives an end date, and
    // a confident forecast here would repeat the overstatement the registry note was corrected
    // for in September 2026.
    body +=
      " No published route gives an end date, so this is a lower bound rather than a forecast.";

    if (metadata.pricingCheckedAt) {
      body += " Price last checked " + metadata.pricingCheckedAt + ".";
    }

    logDebug("Described promotion for sides:", sides);
    return body;
  }

  /**
   * The panel notice as a detached <p>, or null when the price is not promotional.
   *
   * NOT A LIVE REGION, AND IT MUST NOT BECOME ONE. Every panel this lands in is deliberately
   * silent — the model-information panel is aria-live="off" — and the selection change is
   * already announced once elsewhere. A second voice here is the duplicate-announcement defect
   * this codebase has spent two sessions removing.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {HTMLParagraphElement|null}
   */
  function noticeElement(metadata) {
    if (!isPromotional(metadata)) return null;

    const p = document.createElement("p");
    p.className = "modelPricingPromotion";

    const lead = document.createElement("strong");
    lead.textContent = NOTICE_LEAD;
    p.appendChild(lead);
    p.appendChild(document.createTextNode(describe(metadata)));

    return p;
  }

  /**
   * The same notice as an HTML string, for the one consumer that assembles its panel with
   * innerHTML. Returns "" when the price is not promotional.
   *
   * Only registry numbers and a fixed vocabulary reach the markup — no model-supplied prose —
   * so there is nothing here to escape. Prefer noticeElement() where the caller builds DOM.
   *
   * @param {Object} [metadata] - a registry entry's metadata block
   * @returns {string}
   */
  function noticeHTML(metadata) {
    if (!isPromotional(metadata)) return "";
    return (
      '<p class="modelPricingPromotion"><strong>' +
      NOTICE_LEAD +
      "</strong>" +
      describe(metadata) +
      "</p>"
    );
  }

  window.PricingDisplay = {
    MARKER,
    NOTICE_LEAD,
    promotionalSides,
    isPromotional,
    markerFor,
    describe,
    noticeElement,
    noticeHTML,
    METER_UNIT_LABEL,
    METER_LABEL,
    UNIT_NOT_RECORDED,
    meterLines,
    legacyImageLine,
    coverageNote,
    costLinesHTML,
  };

  logInfo("Pricing display helpers ready");
})();
