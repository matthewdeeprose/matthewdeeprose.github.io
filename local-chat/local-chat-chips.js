/**
 * Local Chat — Chips & Welcome Card Module
 * Chip data, selection logic, welcome card rendering, and model info panel.
 *
 * @version 1.0.0 — Stage R2 of Local Chat refactor
 */
(function () {
  "use strict";

  // ── Guard: state module must be loaded first ─────────────────────────────
  var S = window.LocalChatState;
  if (!S) {
    console.error(
      "[LocalChatChips] local-chat-state.js must be loaded before local-chat-chips.js",
    );
    return;
  }

  // ── Starter prompt chips — root/stem system (5b-R) ────────────────────
  // Tier 0 = nano (<500M), Tier 1 = small (500M-2B), Tier 2 = medium (2B+)
  // A model at tier N gets chips from tiers 0..N inclusive.
  var CHIP_ROOTS = [
    // ── Tier 0 (nano — 350M can handle) ──────────────────────
    {
      tier: 0,
      category: "knowledge",
      root: "What is ",
      stems: [
        "the capital of Australia?",
        "the boiling point of water?",
        "the largest ocean on Earth?",
        "the speed of light?",
        "a haiku?",
        "the Dewey Decimal System?",
      ],
    },
    {
      tier: 0,
      category: "rewrite",
      root: "Rewrite this more formally: ",
      stems: [
        '"Hey, can you sort this out ASAP?"',
        '"Gonna be late, traffic is terrible"',
        '"This report is kinda rough, needs work"',
        '"Cheers for the help, really appreciate it"',
      ],
    },
    {
      tier: 0,
      category: "define",
      root: "Define the word ",
      stems: [
        '"ephemeral"',
        '"ubiquitous"',
        '"pragmatic"',
        '"serendipity"',
        '"antithesis"',
        '"juxtaposition"',
      ],
    },
    {
      tier: 0,
      category: "list",
      root: "List 5 ",
      stems: [
        "famous landmarks in Europe",
        "uses for baking soda",
        "types of cloud formation",
        "breakfast foods from around the world",
        "inventions from the 1800s",
      ],
    },
    {
      tier: 0,
      category: "explain-simple",
      root: "Explain ",
      stems: [
        "how a battery works, simply",
        "why the sky is blue, in one paragraph",
        "what an algorithm is, for a beginner",
        "how magnets work, briefly",
        "what inflation means, in plain language",
      ],
    },

    // ── Tier 1 (small — 1B+ can handle) ──────────────────────
    {
      tier: 1,
      category: "creative-short",
      root: "Write a ",
      stems: [
        "haiku about rain on a tin roof",
        "limerick about a confused postman",
        "six-word story about saying goodbye",
        "short riddle about time",
        "two-line joke about a lazy cat",
        "tongue-twister about seashells",
      ],
    },
    {
      tier: 1,
      category: "email",
      root: "Help me draft ",
      stems: [
        "a polite email declining a meeting",
        "a thank-you note for a job interview",
        "an out-of-office auto-reply",
        "a complaint email about a late delivery",
        "a message asking for a deadline extension",
      ],
    },
    {
      tier: 1,
      category: "compare",
      root: "What is the difference between ",
      stems: [
        "a metaphor and a simile?",
        "weather and climate?",
        "a virus and bacteria?",
        "RAM and storage?",
        "empathy and sympathy?",
      ],
    },
    {
      tier: 1,
      category: "advice",
      root: "Give me 3 tips for ",
      stems: [
        "staying focused while studying",
        "writing a good CV",
        "giving a confident presentation",
        "learning a new language",
        "managing stress at work",
      ],
    },
    {
      tier: 1,
      category: "summarise",
      root: "Summarise the concept of ",
      stems: [
        "supply and demand in 3 sentences",
        "photosynthesis for a 10-year-old",
        "the scientific method in plain English",
        "machine learning without jargon",
        "cognitive bias in one paragraph",
      ],
    },

    // ── Tier 2 (medium — 2B+ can handle) ─────────────────────
    {
      tier: 2,
      category: "roleplay",
      root: "Act as a dungeon master for a scenario where we ",
      stems: [
        "raid an undiscovered dungeon beneath a cursed library",
        "hack a cyberpunk corporation's mainframe",
        "go undercover working in a Japanese supermarket",
        "investigate a haunted lighthouse on a remote island",
        "negotiate a treaty between two warring goblin clans",
      ],
    },
    {
      tier: 2,
      category: "text-adventure",
      root: "Be a text adventure parser in a scenario where we ",
      stems: [
        "escape the mystery house before midnight",
        "direct a chaotic fashion show backstage",
        "investigate a Lovecraftian mystery in the harbour",
        "survive a zombie outbreak in a shopping centre",
        "run a medieval tavern for a week",
      ],
    },
    {
      tier: 2,
      category: "debate",
      root: "Present both sides of the argument: ",
      stems: [
        "should homework be abolished?",
        "is social media good for society?",
        "should AI art be considered real art?",
        "are zoos ethical?",
        "should university education be free?",
      ],
    },
    {
      tier: 2,
      category: "creative-long",
      root: "Write the opening paragraph of ",
      stems: [
        "a noir detective novel set in space",
        "a children's story about a dragon who is afraid of fire",
        "a thriller where the detective is the suspect",
        "a comedy about a time traveller stuck in the 1980s",
        "a ghost story told from the ghost's perspective",
      ],
    },
    {
      tier: 2,
      category: "explain-depth",
      root: "Explain in detail ",
      stems: [
        "how public-key cryptography works",
        "the trolley problem and its main variations",
        "how a compiler turns code into machine instructions",
        "the prisoner's dilemma in game theory",
        "how vaccines train the immune system",
      ],
    },
    {
      tier: 2,
      category: "structured",
      root: "Create a structured outline for ",
      stems: [
        "a 30-minute presentation on accessibility",
        "a beginner's guide to photography",
        "a lesson plan teaching fractions to year 5",
        "a blog post about productivity myths",
        "a workshop on creative writing",
      ],
    },
  ];

  var CHIP_ROOTS_CODE = [
    {
      tier: 0,
      category: "code-explain",
      root: "What does ",
      stems: [
        "the `===` operator do in JavaScript?",
        "`margin: 0 auto` do in CSS?",
        "a `for...of` loop do?",
        "the `this` keyword refer to?",
        "`parseInt()` do differently from `Number()`?",
      ],
    },
    {
      tier: 1,
      category: "code-write",
      root: "Write a function that ",
      stems: [
        "reverses a string without built-in methods",
        "checks if a number is prime",
        "converts Celsius to Fahrenheit",
        "removes duplicates from an array",
        "counts the vowels in a sentence",
      ],
    },
    {
      tier: 1,
      category: "code-debug",
      root: "What is wrong with this code: ",
      stems: [
        "`for (let i=0; i<=arr.length; i++)`",
        "`if (x = 5) { ... }`",
        "`document.getElementById('foo').innerHtml`",
        "`const arr = [1,2,3]; arr.push(...[4,5]); return arr.Length`",
        "`setTimeout(myFunc(), 1000)`",
      ],
    },
    {
      tier: 2,
      category: "code-design",
      root: "Explain with an example ",
      stems: [
        "the observer pattern in JavaScript",
        "how closures work and when to use them",
        "the difference between `map`, `filter`, and `reduce`",
        "how async/await handles errors compared to `.catch()`",
        "when to use a Set instead of an Array",
      ],
    },
  ];

  // ── Chip selection logic ──────────────────────────────────────────────

  /**
   * Select 4 diverse starter chips appropriate for the current model and preset.
   * @param {string} modelKey - current model key (e.g. "smollm2-360m")
   * @param {string} presetKey - current preset key (e.g. "code", "default")
   * @returns {string[]} array of 4 chip texts
   */
  function getStarterChips(modelKey, presetKey) {
    var model = window.LocalTextModelRegistry
      ? window.LocalTextModelRegistry.getModel(modelKey)
      : null;
    var paramCount = model ? model.parameterCountNum : 0;

    // Determine tier from parameter count
    var modelTier =
      paramCount >= 2000000000 ? 2 : paramCount >= 500000000 ? 1 : 0;

    // Pick the right pool
    var pool = presetKey === "code" ? CHIP_ROOTS_CODE : CHIP_ROOTS;

    // Filter roots to those at or below the model's tier
    var eligible = pool.filter(function (r) {
      return r.tier <= modelTier;
    });

    // Build one candidate chip per root by picking a random stem
    var allChips = eligible.map(function (r) {
      var stem = r.stems[Math.floor(Math.random() * r.stems.length)];
      return { text: r.root + stem, category: r.category };
    });

    // Shuffle and pick 4, preferring diverse categories
    return pickDiverse(allChips, 4);
  }

  /**
   * Fisher-Yates shuffle then pick N chips, preferring different categories.
   */
  function pickDiverse(chips, count) {
    // Fisher-Yates shuffle
    var shuffled = chips.slice();
    for (var i = shuffled.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = tmp;
    }

    var picked = [];
    var usedCategories = {};

    // First pass: one per category
    for (var k = 0; k < shuffled.length; k++) {
      if (picked.length >= count) break;
      if (!usedCategories[shuffled[k].category]) {
        picked.push(shuffled[k]);
        usedCategories[shuffled[k].category] = true;
      }
    }

    // Second pass: fill remaining slots
    for (var m = 0; m < shuffled.length; m++) {
      if (picked.length >= count) break;
      if (picked.indexOf(shuffled[m]) === -1) {
        picked.push(shuffled[m]);
      }
    }

    return picked.map(function (c) {
      return c.text;
    });
  }

  // ── Hardware labels (for benchmark table) ──────────────────────────────

  var HW_LABELS = {
    "vega-10-igpu": "Vega 10 iGPU (2 GB)",
    "gtx-1650-super": "GTX 1650 SUPER (4 GB)",
    "radeon-780m-igpu": "Radeon 780M iGPU (shared)",
    "rtx-4060": "RTX 4060 (8 GB)",
    "rtx-4070": "RTX 4070 (12 GB)",
  };

  // ── Speed rating helper ───────────────────────────────────────────────

  function getSpeedRating(tokPerSec) {
    var text, dots, cls;
    if (tokPerSec >= 30) {
      text = "Fast";
      dots = "\u25CF\u25CF\u25CF";
      cls = "setup-speed-fast";
    } else if (tokPerSec >= 10) {
      text = "Moderate";
      dots = "\u25CF\u25CF\u25CB";
      cls = "setup-speed-moderate";
    } else if (tokPerSec >= 5) {
      text = "Slow";
      dots = "\u25CF\u25CB\u25CB";
      cls = "setup-speed-slow";
    } else {
      text = "Very slow";
      dots = "\u25CB\u25CB\u25CB";
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

  // ── Preset key helper ────────────────────────────────────────────────

  function getActivePresetKey() {
    return S.els.presetSelect ? S.els.presetSelect.value : "";
  }

  // ── Welcome card ─────────────────────────────────────────────────────

  function renderWelcomeCard() {
    if (!S.els.messageList) return;
    // Don't render if messages exist
    if (S.messages.length > 0) return;
    // Don't render if welcome card already exists
    if (S.els.messageList.querySelector(".local-chat-welcome")) return;

    var card = document.createElement("div");
    card.className = "local-chat-welcome";

    // Model info heading
    var modelName = "Local AI";
    var paramCount = "";
    var contextWindow = "";
    if (S.currentModel && window.LocalTextModelRegistry) {
      var modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
      if (modelDef) {
        if (modelDef.userInfo) {
          modelName = modelDef.userInfo.displayName || modelName;
          paramCount = modelDef.userInfo.parameterCount || "";
        }
        if (modelDef.contextLimit) {
          contextWindow =
            modelDef.contextLimit.toLocaleString() + " token context";
        }
      }
    }

    var heading = document.createElement("h2");
    heading.className = "local-chat-welcome-heading";
    heading.textContent = modelName;
    card.appendChild(heading);

    if (paramCount || contextWindow) {
      var meta = document.createElement("p");
      meta.className = "local-chat-welcome-meta";
      var parts = [];
      if (paramCount) parts.push(paramCount + " parameters");
      if (contextWindow) parts.push(contextWindow);
      meta.textContent = parts.join(" \u00b7 ");
      card.appendChild(meta);
    }

    var intro = document.createElement("p");
    intro.className = "local-chat-welcome-intro";
    intro.textContent = "Try a prompt to get started:";
    card.appendChild(intro);

    // Chip buttons (5b-R: root/stem combinatorial system)
    var presetKey = getActivePresetKey();
    var chipTexts = getStarterChips(S.currentModel, presetKey);

    var chipBar = document.createElement("div");
    chipBar.className = "local-chat-chip-bar";

    chipTexts.forEach(function (text) {
      var chip = document.createElement("button");
      chip.className = "local-chat-chip";
      chip.textContent = text;
      chip.addEventListener("click", function () {
        if (S.els.input) {
          S.els.input.value = text;
        }
        // Call the global send handler (stays in core)
        window.localChatSend();
      });
      chipBar.appendChild(chip);
    });

    card.appendChild(chipBar);

    S.els.messageList.appendChild(card);
  }

  function removeWelcomeCard() {
    if (!S.els.messageList) return;
    var card = S.els.messageList.querySelector(".local-chat-welcome");
    if (card) card.remove();
  }

  // ── Model info panel (5b) ─────────────────────────────────────────────

  function updateModelInfo() {
    if (!S.els.modelInfo) return;

    if (!S.currentModel || !window.LocalTextModelRegistry) {
      S.els.modelInfo.textContent = "No model information available.";
      return;
    }

    var modelDef = window.LocalTextModelRegistry.getModel(S.currentModel);
    if (!modelDef || !modelDef.userInfo) {
      S.els.modelInfo.textContent = "No model information available.";
      return;
    }

    var info = modelDef.userInfo;
    S.els.modelInfo.innerHTML = "";

    // Summary
    if (info.summary) {
      var summary = document.createElement("p");
      summary.className = "local-chat-model-info-summary";
      summary.textContent = info.summary;
      S.els.modelInfo.appendChild(summary);
    }

    // Specs table
    var specs = [];
    if (info.parameterCount) specs.push(["Parameters", info.parameterCount]);
    if (info.downloadSizeMB)
      specs.push([
        "Download size",
        info.downloadSizeMB >= 1000
          ? (info.downloadSizeMB / 1000).toFixed(1) + " GB"
          : info.downloadSizeMB + " MB",
      ]);
    if (modelDef.contextLimit)
      specs.push([
        "Context window",
        modelDef.contextLimit.toLocaleString() + " tokens",
      ]);
    if (info.licence) specs.push(["Licence", info.licence]);
    if (info.provider) specs.push(["Provider", info.provider]);

    if (specs.length > 0) {
      var dl = document.createElement("dl");
      dl.className = "local-chat-model-info-specs";
      specs.forEach(function (pair) {
        var dt = document.createElement("dt");
        dt.textContent = pair[0];
        dl.appendChild(dt);
        var dd = document.createElement("dd");
        dd.textContent = pair[1];
        dl.appendChild(dd);
      });
      S.els.modelInfo.appendChild(dl);
    }

    // Best for
    if (info.bestFor) {
      var bestFor = document.createElement("p");
      bestFor.className = "local-chat-model-info-best-for";
      bestFor.innerHTML = "<strong>Best for:</strong> " + info.bestFor;
      S.els.modelInfo.appendChild(bestFor);
    }

    // Benchmark table
    if (info.benchmarks) {
      var benchmarks = info.benchmarks;
      var hwKeys = Object.keys(benchmarks);
      if (hwKeys.length > 0) {
        var benchModelName = info.displayName || S.currentModel || "Model";
        var table = document.createElement("table");
        table.className = "local-chat-benchmark-table allyTable";
        table.setAttribute(
          "aria-label",
          benchModelName + " expected speed by hardware",
        );

        var thead = document.createElement("thead");
        thead.innerHTML =
          "<tr>" +
          '<th scope="col">Hardware</th>' +
          '<th scope="col">Speed</th>' +
          '<th scope="col">Context safe</th>' +
          '<th scope="col">Rating</th>' +
          "</tr>";
        table.appendChild(thead);

        var tbody = document.createElement("tbody");
        hwKeys.forEach(function (hwKey) {
          var bm = benchmarks[hwKey];
          var row = document.createElement("tr");
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
        S.els.modelInfo.appendChild(table);
      }
    }
  }

  // ── Expose module ────────────────────────────────────────────────────

  window.LocalChatChips = {
    getStarterChips: getStarterChips,
    getSpeedRating: getSpeedRating,
    renderWelcomeCard: renderWelcomeCard,
    removeWelcomeCard: removeWelcomeCard,
    updateModelInfo: updateModelInfo,
  };

  S.logInfo("Chips module loaded");
})();
