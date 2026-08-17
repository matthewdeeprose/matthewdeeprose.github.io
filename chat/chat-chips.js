/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHAT CHIPS — Unified Chat starter-prompts render + lifecycle
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Reads the committed data list (window.ChatStarterPrompts) and paints the
 * empty-conversation "welcome" region built in step 2: a single set of
 * starter-prompt chips (a diverse, capability-filtered random pick) that always
 * includes at least one assistive-technology-tagged chip. Owns showing and
 * hiding that region as the conversation goes from empty to non-empty and back.
 *
 * SELF-CONTAINED + INERT UNTIL WIRED. This module does NOT touch tools.html,
 * chat-core.js, chat.js, chat-persistence.js or chat.css. Nothing outside calls
 * it yet — the lifecycle wiring into those seams (reflectSelection, the
 * post-clear/post-restore syncs) is the SEPARATE step 4. The only thing that
 * runs this module in step 3 is its own DOMContentLoaded init, which does a
 * single syncToConversationState() so a fresh empty load shows the welcome.
 *
 * Reads its collaborators LIVE at call time (window.Chat, window.ChatAttach,
 * window.EmbedModelSelector, window.ChatStarterPrompts, window.IconLibrary),
 * each guarded, so a load-order gap degrades to a logged no-op rather than a
 * throw. window.ChatState is the one stable singleton — captured once at load
 * (const S) behind a missing-state guard.
 *
 * Public API (window.ChatChips):
 *   syncToConversationState()  → void   show when empty, hide when non-empty
 *   refresh()                  → void   re-pick the set (only while shown)
 *   renderWelcome()            → void   paint + reveal (empty conversation only)
 *   removeWelcome()            → void   clear the chip sets + hide the region
 *   pickChips(n)               → chip[] the everyday pick (exposed for tests)
 *
 * Architecture: IIFE with a window global. No NPM — loaded via a <script> tag.
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ChatChips = (function () {
  "use strict";

  // ── Logging (own sink; British spelling) ──────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ChatChips]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ChatChips]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[ChatChips]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ChatChips]", message, ...args);
  }

  // ── State (the one stable singleton, captured once) ───────────────────────
  const S = window.ChatState || null;
  if (!S) {
    // No throw at load — the public API is still defined, but every entry point
    // guards on S and no-ops. init() also refuses to run without it.
    logWarn("window.ChatState unavailable at load — starter prompts will be inert");
  }

  // ── Shell ids (the literal ids the step-2 markup provides) ────────────────
  const WELCOME_ID = "chat-welcome";
  const EVERYDAY_CHIPS_ID = "chat-welcome-chips";

  // Requirement tokens carried by a prompt's `requires` array.
  const REQ_IMAGE = "image";
  const REQ_PDF = "pdf";
  const REQ_REASONING = "reasoning";

  // The tag marking a prompt as assistive-technology-oriented; used to guarantee
  // at least one such chip in the set.
  const ASSISTIVE_TAG = "assistive";

  // Responsive chip-count breakpoints for the everyday set (read live, no listener).
  const WIDTH_WIDE = 1200; // 5 chips
  const WIDTH_MEDIUM = 900; //  4 chips
  const WIDTH_NARROW = 600; //  3 chips (below this: 2)

  // ── Element helpers (looked up live; the region may not be present) ───────
  function welcomeEl() {
    return document.getElementById(WELCOME_ID);
  }
  function everydayChipsEl() {
    return document.getElementById(EVERYDAY_CHIPS_ID);
  }
  // The shared chat controls resolve through the ChatState id-prefix, matching
  // how chat-core.js finds them (elId("input") → "chat-input").
  function chatInputEl() {
    const id = S && typeof S.elId === "function" ? S.elId("input") : "chat-input";
    return document.getElementById(id);
  }
  function chatAttachInputEl() {
    const id =
      S && typeof S.elId === "function" ? S.elId("attach-input") : "chat-attach-input";
    return document.getElementById(id);
  }

  // True when the welcome shell the single-set render actually needs (the region
  // + the everyday chip host) is present. That is the whole shell now — the
  // separate assistive sub-group was removed from the markup in Rev B2.
  function shellPresent() {
    if (!welcomeEl() || !everydayChipsEl()) {
      logWarn(
        "Starter-prompts shell not found (missing #chat-welcome or #chat-welcome-chips) — no-op"
      );
      return false;
    }
    return true;
  }

  // ── Eligibility ───────────────────────────────────────────────────────────
  // A prompt is capability-eligible when EVERY token in its `requires` array is
  // satisfied by the current model. No `requires` (or []) = always eligible.
  // Each collaborator is read live and guarded; an unavailable gate resolves to
  // "not satisfied", so a required chip simply does not appear.
  function capabilityEligible(prompt) {
    const reqs = Array.isArray(prompt.requires) ? prompt.requires : [];
    if (reqs.length === 0) return true;

    const modelId = S ? S.currentModel : null;
    const attach = window.ChatAttach;

    for (const req of reqs) {
      if (req === REQ_IMAGE) {
        if (
          !attach ||
          typeof attach.modelAcceptsImages !== "function" ||
          !attach.modelAcceptsImages(modelId)
        ) {
          return false;
        }
      } else if (req === REQ_PDF) {
        if (
          !attach ||
          typeof attach.modelAcceptsPDF !== "function" ||
          !attach.modelAcceptsPDF(modelId)
        ) {
          return false;
        }
      } else if (req === REQ_REASONING) {
        const Chat = window.Chat;
        const selector = window.EmbedModelSelector;
        if (
          !Chat ||
          typeof Chat.getModelEntry !== "function" ||
          !selector ||
          typeof selector._modelHasCapabilities !== "function"
        ) {
          return false;
        }
        const entry = Chat.getModelEntry(modelId);
        if (!entry || !selector._modelHasCapabilities(entry, ["reasoning"])) {
          return false;
        }
      } else {
        // Unknown requirement token — exclude conservatively rather than guess.
        logWarn(
          "Unknown requirement '" + req + "' on prompt '" + prompt.id + "' — excluding"
        );
        return false;
      }
    }
    return true;
  }

  // A prompt survives only if its decorative icon is one the library knows, so a
  // chip never renders an empty icon span. When the library is unavailable we
  // cannot check, so we keep the prompt (populate falls back gracefully).
  function iconKnown(prompt) {
    if (!prompt.icon) return true; // no icon requested
    const lib = window.IconLibrary;
    if (!lib || typeof lib.hasIcon !== "function") return true; // cannot verify
    if (lib.hasIcon(prompt.icon)) return true;
    logWarn("Skipping prompt '" + prompt.id + "': unknown icon '" + prompt.icon + "'");
    return false;
  }

  // ── Randomness helpers ────────────────────────────────────────────────────
  function randomIndex(length) {
    return Math.floor(Math.random() * length);
  }
  // Fisher–Yates on a copy — never mutates the source array.
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = randomIndex(i + 1);
      const tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
    }
    return a;
  }

  // ── Chip descriptors ──────────────────────────────────────────────────────
  // Resolve a prompt to its display text: `text` if present, else `root` plus one
  // random `stems` entry.
  function resolveText(prompt) {
    if (typeof prompt.text === "string" && prompt.text) return prompt.text;
    const root = typeof prompt.root === "string" ? prompt.root : "";
    const stems = Array.isArray(prompt.stems) ? prompt.stems : [];
    if (stems.length === 0) return root;
    return root + stems[randomIndex(stems.length)];
  }

  // { id, icon, label, action } — the minimal shape the button builder needs.
  function toChip(prompt) {
    return {
      id: prompt.id,
      icon: prompt.icon || "",
      label: resolveText(prompt),
      action: prompt.action === "attach" ? "attach" : "send",
    };
  }

  // ── Everyday pick (diverse, capability-filtered, AT-guaranteed) ───────────
  // Keep only eligible prompts, then SEED the pick with one random eligible
  // assistive-tagged prompt so the set always offers at least one AT chip. Fill
  // the remaining slots with one random prompt per pool (pools in random order)
  // for variety — skipping the seed's own pool where other pools can supply a
  // pick — then top up from the remaining eligible if still short. The seed sits
  // at index 0, so it survives the final slice for any responsive count (n ≥ 2).
  // If no assistive prompt is eligible (defensive — most carry no `requires`),
  // it falls back to the plain diverse pick.
  function pickChips(n) {
    const data = window.ChatStarterPrompts;
    if (!data || !Array.isArray(data.prompts)) {
      logWarn("pickChips: ChatStarterPrompts data unavailable");
      return [];
    }

    const eligible = data.prompts.filter(function (p) {
      return capabilityEligible(p) && iconKnown(p);
    });
    if (eligible.length === 0) return [];

    const picked = [];
    const pickedIds = new Set();
    const seededPools = new Set();

    // Seed one eligible assistive-tagged prompt — this is the AT guarantee.
    const assistivePool = eligible.filter(function (p) {
      return Array.isArray(p.tags) && p.tags.indexOf(ASSISTIVE_TAG) !== -1;
    });
    if (assistivePool.length > 0) {
      const seed = assistivePool[randomIndex(assistivePool.length)];
      picked.push(seed);
      pickedIds.add(seed.id);
      if (seed.pool) seededPools.add(seed.pool);
    }

    // Group the still-unpicked eligible prompts by pool.
    const byPool = {};
    eligible.forEach(function (p) {
      if (pickedIds.has(p.id)) return;
      const key = p.pool || "_none";
      if (!byPool[key]) byPool[key] = [];
      byPool[key].push(p);
    });

    // One per pool, pools in random order — but prefer pools other than the seed's
    // so the set stays varied (the seed already represents its pool).
    const poolKeys = shuffle(Object.keys(byPool));
    for (const key of poolKeys) {
      if (picked.length >= n) break;
      if (seededPools.has(key)) continue;
      const pool = byPool[key];
      const choice = pool[randomIndex(pool.length)];
      picked.push(choice);
      pickedIds.add(choice.id);
    }

    // Fill to n from the remaining eligible (not already picked), in random order.
    // The seed's own pool can contribute here if the set is otherwise short.
    if (picked.length < n) {
      const remaining = shuffle(
        eligible.filter(function (p) {
          return !pickedIds.has(p.id);
        })
      );
      for (const p of remaining) {
        if (picked.length >= n) break;
        picked.push(p);
        pickedIds.add(p.id);
      }
    }

    return picked.slice(0, n).map(toChip);
  }

  // ── Button construction ───────────────────────────────────────────────────
  // Native <button> + decorative icon span (aria-hidden) + a visible label span.
  // Icons are populated on the built subtree (the chat-attach.js idiom), so no
  // empty icon spans reach the DOM.
  function buildChipButton(chip) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chat-chip";
    btn.setAttribute("data-prompt-id", chip.id);
    btn.setAttribute("data-action", chip.action);

    const iconSpan = document.createElement("span");
    iconSpan.setAttribute("aria-hidden", "true"); // decorative — the label names it
    if (chip.icon) iconSpan.setAttribute("data-icon", chip.icon);
    btn.appendChild(iconSpan);

    const label = document.createElement("span");
    label.className = "chat-chip-label";
    label.textContent = chip.label; // textContent — never innerHTML (safe)
    btn.appendChild(label);

    btn.addEventListener("click", function () {
      onChipClick(chip);
    });

    // Dynamically-inserted data-icon spans are not auto-populated — do it now.
    const lib = window.IconLibrary;
    if (lib && typeof lib.populateIcons === "function") {
      lib.populateIcons(btn);
    } else if (typeof window.refreshIcons === "function") {
      window.refreshIcons(btn);
    }
    return btn;
  }

  // ── Chip activation ───────────────────────────────────────────────────────
  // "send"   → fill the composer, then send (chatSend/sendMessage clears the input).
  // "attach" → fill the composer with the caption, open the native file picker,
  //            and do NOT send. No announcement is added on either path — a send
  //            inherits "Generating response." from the send flow.
  function onChipClick(chip) {
    const input = chatInputEl();
    if (!input) {
      logWarn("onChipClick: chat input not found — no-op");
      return;
    }
    input.value = chip.label;

    if (chip.action === "attach") {
      const attachInput = chatAttachInputEl();
      if (attachInput && typeof attachInput.click === "function") {
        attachInput.click();
      } else {
        logWarn("onChipClick: attach input not found for an attach chip");
      }
      return;
    }

    if (typeof window.chatSend === "function") {
      window.chatSend();
    } else {
      logWarn("onChipClick: window.chatSend unavailable — nothing sent");
    }
  }

  // ── Responsive count (re-read each render; no resize listener) ────────────
  function responsiveCount() {
    const w = typeof window.innerWidth === "number" ? window.innerWidth : 0;
    if (w >= WIDTH_WIDE) return 5;
    if (w >= WIDTH_MEDIUM) return 4;
    if (w >= WIDTH_NARROW) return 3;
    return 2;
  }

  // ── Region state ──────────────────────────────────────────────────────────
  function isShown() {
    const welcome = welcomeEl();
    return !!welcome && !welcome.hasAttribute("hidden");
  }
  function everydayEmpty() {
    const host = everydayChipsEl();
    return !host || host.children.length === 0;
  }

  // ── Render / remove ───────────────────────────────────────────────────────
  function renderWelcome() {
    if (!S) {
      logWarn("renderWelcome: ChatState unavailable — no-op");
      return;
    }
    if (!shellPresent()) return;
    if (!S.messages || S.messages.length !== 0) {
      logDebug("renderWelcome: skipped (conversation is not empty)");
      return;
    }

    const everydayHost = everydayChipsEl();

    // Single set — responsive count, diverse pick with a guaranteed assistive chip
    // (pickChips seeds one). No separate assistive group is rendered any more.
    const n = responsiveCount();
    everydayHost.textContent = "";
    const chips = pickChips(n);
    chips.forEach(function (chip) {
      everydayHost.appendChild(buildChipButton(chip));
    });

    // The heading text stays exactly as the HTML provides — never set here.
    welcomeEl().removeAttribute("hidden");
    logInfo("renderWelcome complete", {
      chips: chips.length,
      requested: n,
    });
  }

  function removeWelcome() {
    const everydayHost = everydayChipsEl();
    if (everydayHost) everydayHost.textContent = "";
    // Hiding the whole #chat-welcome region hides every descendant with it, so
    // no separate sub-group clear is needed.
    const welcome = welcomeEl();
    if (welcome) welcome.setAttribute("hidden", "");
    logDebug("removeWelcome complete");
  }

  // ── Lifecycle entry points ────────────────────────────────────────────────
  // Idempotent: show on an empty conversation (only when hidden or shown-empty,
  // so an unrelated UI sync does not reshuffle a set already on screen), hide on
  // a non-empty one.
  function syncToConversationState() {
    if (!S) {
      logWarn("syncToConversationState: ChatState unavailable — no-op");
      return;
    }
    const count = S.messages ? S.messages.length : 0;
    if (count > 0) {
      removeWelcome();
      return;
    }
    if (isShown() && !everydayEmpty()) {
      logDebug("syncToConversationState: welcome already shown — no reshuffle");
      return;
    }
    renderWelcome();
  }

  // Re-pick + re-render both sets for the current model — but ONLY while the
  // welcome is on screen (the empty state). This is what step 4's model-change
  // hook (reflectSelection) will call. A no-op otherwise.
  function refresh() {
    if (!isShown()) {
      logDebug("refresh: welcome not shown — no-op");
      return;
    }
    renderWelcome();
  }

  // ── Self-init (the ONLY thing that runs this module in step 3) ────────────
  function init() {
    if (!S) {
      logWarn("init: window.ChatState unavailable — starter prompts inert");
      return;
    }
    syncToConversationState();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    syncToConversationState: syncToConversationState,
    refresh: refresh,
    renderWelcome: renderWelcome,
    removeWelcome: removeWelcome,
    pickChips: pickChips,
  };
})();
