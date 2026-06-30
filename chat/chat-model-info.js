/**
 * Unified Chat Tool — cross-provider Model information populator (Chat 5c-iii-b)
 *
 * Fills the "Model information" disclosure body (#chat-model-info-body) from the
 * currently-selected model, across all three provider surfaces:
 *   - LOCAL (on-device): rich detail from window.LocalTextModelRegistry's
 *     userInfo (summary, specs, "Best for", per-hardware benchmark table).
 *   - CLOUD OpenRouter / Microsoft Foundry: a common core (name, context window,
 *     capabilities) plus description, "Best for", and a per-provider cost line
 *     (OpenRouter shows $ figures; Foundry shows "Billed via your institution"
 *     plus its routing deployment/region).
 *
 * Reads the unified entry through window.Chat.getModelEntry — the same cached,
 * gated list the picker shows — and the context limit through
 * window.Chat.getContextLimit. Local entries in that unified list are lean
 * (id/name/contextLimit/capabilities only), so the local branch reaches into the
 * registry directly for the rich userInfo, mirroring local-chat/local-chat-chips.js.
 *
 * Wiring into reflectSelection() is Chat 5c-iii-c; this file just loads and
 * exposes window.ChatModelInfo. Loads AFTER chat/chat.js (which creates
 * window.ChatState and window.Chat).
 *
 * @version 0.1.0 — Chat 5c-iii-b (cross-provider populator)
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
      args.unshift("[ChatModelInfo]");
      console.error.apply(console, args);
    }
  }

  function logWarn(message) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatModelInfo]");
      console.warn.apply(console, args);
    }
  }

  function logInfo(message) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatModelInfo]");
      console.log.apply(console, args);
    }
  }

  function logDebug(message) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      const args = Array.prototype.slice.call(arguments);
      args.unshift("[ChatModelInfo]");
      console.log.apply(console, args);
    }
  }

  // ── State handle ─────────────────────────────────────────────────────────
  // Re-bindable module-local reference to this tool's conversation state.
  // Defaults to window.ChatState; attach(state) can re-point it. Internal code
  // reads the state — its currentModel and els{} DOM map — live through S at call
  // time, never caching them at load (parity with chat-persistence.js).
  let S = window.ChatState;
  if (!S) {
    logError(
      "window.ChatState is missing — chat/chat.js must load before chat/chat-model-info.js",
    );
    return;
  }

  // Re-point the module at a freshly-attached state object.
  function attach(state) {
    if (state) S = state;
  }

  // ── Local-side constants (ported verbatim from local-chat-chips.js) ────────
  // Hardware display labels for the per-hardware benchmark table.
  const HW_LABELS = {
    "vega-10-igpu": "Vega 10 iGPU (2 GB)",
    "gtx-1650-super": "GTX 1650 SUPER (4 GB)",
    "radeon-780m-igpu": "Radeon 780M iGPU (shared)",
    "rtx-4060": "RTX 4060 (8 GB)",
    "rtx-4070": "RTX 4070 (12 GB)",
  };

  // Speed-rating badge (text + filled/empty dots), keyed on tokens/sec. Returns
  // an HTML string of CONTROLLED content only (no model-supplied free text).
  function getSpeedRating(tokPerSec) {
    let text, dots, cls;
    if (tokPerSec >= 30) {
      text = "Fast";
      dots = "●●●";
      cls = "setup-speed-fast";
    } else if (tokPerSec >= 10) {
      text = "Moderate";
      dots = "●●○";
      cls = "setup-speed-moderate";
    } else if (tokPerSec >= 5) {
      text = "Slow";
      dots = "●○○";
      cls = "setup-speed-slow";
    } else {
      text = "Very slow";
      dots = "○○○";
      cls = "setup-speed-very-slow";
    }
    return (
      '<span class="setup-speed-rating ' +
      cls +
      '" aria-label="' +
      text +
      ": " +
      tokPerSec +
      ' tokens per second">' +
      dots +
      "</span>"
    );
  }

  // ── Capability tidier ──────────────────────────────────────────────────────
  // Turn a raw capability token into readable text: underscores → spaces and
  // upper-case the first letter, with explicit overrides for initialisms.
  const CAPABILITY_OVERRIDES = {
    pdf: "PDF",
  };

  function formatCapability(token) {
    if (typeof token !== "string" || token === "") return "";
    if (CAPABILITY_OVERRIDES[token]) return CAPABILITY_OVERRIDES[token];
    const spaced = token.replace(/_/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  // ── Small DOM helpers ──────────────────────────────────────────────────────

  // The "local/" prefix strip — same logic as chat.js localKeyFromId. Returns the
  // SHORT registry key for an on-device id, else null (a cloud model).
  function localKeyFromId(id) {
    const PREFIX = "local/";
    return typeof id === "string" && id.indexOf(PREFIX) === 0
      ? id.slice(PREFIX.length)
      : null;
  }

  // Append a paragraph with text content (never HTML) under `parent`.
  function appendParagraph(parent, text, className) {
    const p = document.createElement("p");
    if (className) p.className = className;
    p.textContent = text;
    parent.appendChild(p);
    return p;
  }

  // Append a "<strong>Label:</strong> value" paragraph. Label is a fixed string
  // we control; value is model-supplied and so set via textContent on a span.
  function appendLabelled(parent, label, value, className) {
    const p = document.createElement("p");
    if (className) p.className = className;
    const strong = document.createElement("strong");
    strong.textContent = label + ":";
    p.appendChild(strong);
    p.appendChild(document.createTextNode(" "));
    const span = document.createElement("span");
    span.textContent = value;
    p.appendChild(span);
    parent.appendChild(p);
    return p;
  }

  // Build a <dl> of [label, value] pairs (label fixed, value via textContent).
  function appendSpecsList(parent, pairs, className) {
    if (!pairs.length) return null;
    const dl = document.createElement("dl");
    if (className) dl.className = className;
    pairs.forEach(function (pair) {
      const dt = document.createElement("dt");
      dt.textContent = pair[0];
      dl.appendChild(dt);
      const dd = document.createElement("dd");
      dd.textContent = pair[1];
      dl.appendChild(dd);
    });
    parent.appendChild(dl);
    return dl;
  }

  // Capabilities as a comma-joined text paragraph (tidied tokens). `tokens` is an
  // array; falls back to nothing when empty.
  function appendCapabilities(parent, tokens) {
    const list = (tokens || [])
      .map(formatCapability)
      .filter(function (t) {
        return t !== "";
      });
    if (!list.length) return;
    appendLabelled(parent, "Capabilities", list.join(", "));
  }

  // Format a download size in MB the way Local Chat does (>= 1000 → GB).
  function formatDownloadSize(mb) {
    return mb >= 1000 ? (mb / 1000).toFixed(1) + " GB" : mb + " MB";
  }

  // ── Renderers ──────────────────────────────────────────────────────────────

  /**
   * Render an on-device model's information from its registry userInfo. `body`
   * is already emptied. `shortKey` is the registry key (no "local/" prefix);
   * `fullId` is the id stored in ChatState (for the context-limit lookup).
   */
  function renderLocal(body, shortKey, fullId) {
    const registry = window.LocalTextModelRegistry;
    const modelDef =
      registry && typeof registry.getModel === "function"
        ? registry.getModel(shortKey)
        : null;

    if (!modelDef || !modelDef.userInfo) {
      // Minimal core when the registry has no rich entry.
      logWarn("renderLocal: no registry userInfo for '" + shortKey + "'");
      appendLabelled(
        body,
        "Context window",
        contextLabel(fullId),
        "chat-model-info-context",
      );
      appendCapabilities(body, ["text"]);
      return;
    }

    const info = modelDef.userInfo;

    // Summary
    if (info.summary) {
      appendParagraph(body, info.summary, "chat-model-info-summary");
    }

    // Specs table
    const specs = [];
    if (info.parameterCount) specs.push(["Parameters", info.parameterCount]);
    if (info.downloadSizeMB)
      specs.push(["Download size", formatDownloadSize(info.downloadSizeMB)]);
    specs.push(["Context window", contextLabel(fullId)]);
    if (info.licence) specs.push(["Licence", info.licence]);
    if (info.provider) specs.push(["Provider", info.provider]);
    appendSpecsList(body, specs, "chat-model-info-specs");

    // Capabilities — locals are text-only in the unified list.
    appendCapabilities(body, ["text"]);

    // Best for (a STRING for locals)
    if (info.bestFor) {
      appendLabelled(body, "Best for", info.bestFor, "chat-model-info-best-for");
    }

    // Benchmark table — ported from local-chat-chips.js (controlled content).
    if (info.benchmarks) {
      const benchmarks = info.benchmarks;
      const hwKeys = Object.keys(benchmarks);
      if (hwKeys.length > 0) {
        const benchModelName = info.displayName || shortKey || "Model";
        const table = document.createElement("table");
        table.className = "local-chat-benchmark-table allyTable";
        table.setAttribute(
          "aria-label",
          benchModelName + " expected speed by hardware",
        );

        const thead = document.createElement("thead");
        thead.innerHTML =
          "<tr>" +
          '<th scope="col">Hardware</th>' +
          '<th scope="col">Speed</th>' +
          '<th scope="col">Context safe</th>' +
          '<th scope="col">Rating</th>' +
          "</tr>";
        table.appendChild(thead);

        const tbody = document.createElement("tbody");
        hwKeys.forEach(function (hwKey) {
          const bm = benchmarks[hwKey];
          const row = document.createElement("tr");
          row.innerHTML =
            '<td data-label="Hardware">' +
            (HW_LABELS[hwKey] || hwKey) +
            "</td>" +
            '<td data-label="Speed">' +
            bm.tokPerSec +
            " tok/s</td>" +
            '<td data-label="Context safe">' +
            (bm.contextSafe ? "Yes" : "Limited") +
            "</td>" +
            '<td data-label="Rating">' +
            getSpeedRating(bm.tokPerSec) +
            "</td>";
          tbody.appendChild(row);
        });
        table.appendChild(tbody);
        body.appendChild(table);
      }
    }
  }

  /**
   * Render a cloud model (OpenRouter or Microsoft Foundry) from its unified
   * entry. `body` is already emptied. `entry` is the unified entry; `id` is the
   * full model id (for the context-limit lookup).
   */
  function renderCloud(body, entry, id) {
    // Common core: name, context window, capabilities.
    if (entry.name) {
      appendLabelled(body, "Model", entry.name, "chat-model-info-name");
    }
    appendLabelled(
      body,
      "Context window",
      contextLabel(id),
      "chat-model-info-context",
    );
    appendCapabilities(body, entry.capabilities);

    // Description
    if (entry.description) {
      appendParagraph(body, entry.description, "chat-model-info-description");
    }

    // Best for — an ARRAY for cloud entries (under metadata).
    const bestFor = entry.metadata && entry.metadata.bestFor;
    if (Array.isArray(bestFor) && bestFor.length) {
      appendLabelled(
        body,
        "Best for",
        bestFor.join(", "),
        "chat-model-info-best-for",
      );
    }

    // Cost — per provider.
    if (entry.providerId === "azure-openai") {
      appendLabelled(
        body,
        "Cost",
        "Billed via your institution",
        "chat-model-info-cost",
      );
      // Foundry routing detail.
      const routing = entry.metadata && entry.metadata.routing;
      if (routing) {
        if (routing.deployment) {
          appendLabelled(body, "Deployment", routing.deployment);
        }
        if (routing.region) {
          appendLabelled(body, "Region", routing.region);
        }
      }
    } else if (entry.providerId === "openrouter") {
      if (entry.costs) {
        appendLabelled(
          body,
          "Cost",
          "$" +
            entry.costs.input +
            " / $" +
            entry.costs.output +
            " per million tokens (input / output)",
          "chat-model-info-cost",
        );
      }
    }
  }

  /**
   * Render the minimal core for an unknown / not-found model id (no entry in the
   * unified list and not an on-device id). Shows whatever is safely available.
   */
  function renderUnknown(body, id) {
    appendLabelled(
      body,
      "Context window",
      contextLabel(id),
      "chat-model-info-context",
    );
  }

  // Context-window label string via window.Chat.getContextLimit, guarded.
  function contextLabel(id) {
    let limit = null;
    if (window.Chat && typeof window.Chat.getContextLimit === "function") {
      limit = window.Chat.getContextLimit(id);
    }
    return (typeof limit === "number" ? limit.toLocaleString() : "Unknown") +
      " tokens";
  }

  // ── Public update ──────────────────────────────────────────────────────────

  /**
   * Repopulate the Model information body from S.currentModel. Self-clearing:
   * a null/empty currentModel renders "No model selected." (covers the opening
   * policy's "none" path). Looks the body element up fresh each call.
   */
  function update() {
    const body = document.getElementById(S.elId("model-info-body"));
    if (!body) {
      logWarn("update: #" + S.elId("model-info-body") + " not found");
      return;
    }

    const id = S.currentModel;
    body.innerHTML = "";

    if (!id) {
      appendParagraph(body, "No model selected.");
      logDebug("update: no model selected — body cleared");
      return;
    }

    const shortKey = localKeyFromId(id);
    if (shortKey !== null) {
      renderLocal(body, shortKey, id);
      logDebug("update: rendered local model '" + id + "'");
      return;
    }

    const entry =
      window.Chat && typeof window.Chat.getModelEntry === "function"
        ? window.Chat.getModelEntry(id)
        : null;

    if (entry && (entry.providerId === "openrouter" || entry.providerId === "azure-openai")) {
      renderCloud(body, entry, id);
      logDebug("update: rendered cloud model '" + id + "' (" + entry.providerId + ")");
      return;
    }

    // Unknown / not found in the unified list.
    logWarn("update: no unified entry for '" + id + "' — minimal core rendered");
    if (entry && entry.name) {
      appendLabelled(body, "Model", entry.name, "chat-model-info-name");
    }
    renderUnknown(body, id);
    if (entry && entry.capabilities) {
      appendCapabilities(body, entry.capabilities);
    }
  }

  // ── Expose module ────────────────────────────────────────────────────────
  window.ChatModelInfo = {
    update: update,
    attach: attach,
  };

  logInfo("Model information module loaded");
})();
