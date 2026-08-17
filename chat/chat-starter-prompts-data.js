/**
 * Chat starter prompts — the data list the chip renderer reads.
 *
 * This is the "list you append to". Adding a prompt is adding one object below.
 * The render logic reads this and never changes when you add prompts.
 *
 * Schema of one prompt object:
 *   id       string   stable unique name
 *   pool     string   one of the pool keys below (its natural strand; drives the
 *                     one-per-pool variety in the everyday pick)
 *   icon     string   an IconLibrary name (decorative, hidden from screen readers)
 *   text     string   the full prompt the chip sends           (use text OR root+stems)
 *   root     string   fixed lead of a combinatorial prompt      (use with stems)
 *   stems    string[] endings; chip text = root + one random stem
 *   tags     string[] optional facets beyond the pool. "assistive" marks a prompt
 *                     that also belongs to the assistive-technology set, so it can
 *                     be BOTH woven into its strand AND grouped separately, with no
 *                     duplicate entry. Omit or [] = no extra facet.
 *   requires string[] capabilities the model must have; omit or [] = always eligible
 *                     values: "pdf", "image", "reasoning"
 *   action   string   "send" (one tap sends) or "attach" (fills input, opens picker)
 *                     omit = "send"
 *
 * Content source: the 24 accessibility-and-inclusion categories (one root each),
 * with the assistive-technology patterns from the document's Tier 1 table woven in:
 * category roots that already ARE an AT tool pattern are tagged "assistive" (double
 * duty), and the distinct AT patterns are added to their natural strands, tagged.
 *
 * British spelling throughout. Conversational voice — most chips are openers the
 * model answers by asking for the topic, text, or draft.
 *
 * NOTE ON WELLBEING (category 24): study-skills coaching ONLY. Stems stay on
 * routines, focus, and starting work. Nothing here strays into emotional or
 * mental-health support, which has a hard boundary and is signposted elsewhere.
 */
(function () {
  "use strict";

  window.ChatStarterPrompts = {
    pools: [
      { key: "think", label: "Think" },
      { key: "understand", label: "Understand" },
      { key: "transform", label: "Transform" },
      { key: "organise", label: "Organise" },
      { key: "practise", label: "Practise" },
      { key: "create", label: "Create" },
      { key: "communicate", label: "Communicate" },
    ],

    // The label for the separate assistive-technology grouping (drawn by tag).
    assistiveLabel: "Assistive technology",

    prompts: [
      // ===== Think (reasoning) =====
      { id: "think-devils-advocate", pool: "think", icon: "swap",
        root: "Play devil's advocate on ",
        stems: ["my essay's main argument", "a decision I'm weighing up",
                "a claim I keep seeing online", "the position I currently hold"] },
      { id: "think-socratic", pool: "think", icon: "questionCircle",
        root: "Ask me questions to deepen my understanding of ",
        stems: ["a topic I'm revising", "an idea I'm not sure I follow",
                "something I have to explain to others soon", "a concept from this week's teaching"] },
      { id: "think-verify", pool: "think", icon: "checkCircle",
        root: "Help me fact-check ",
        stems: ["a claim I read and want to cite", "a statistic before I rely on it",
                "a surprising thing I was told", "a source I'm unsure about"] },
      { id: "think-perspective", pool: "think", icon: "crop",
        root: "Tell me whose perspective is missing from ",
        stems: ["an argument I'll paste", "the sources on my reading list",
                "the way this topic is usually taught", "my own draft"] },

      // ===== Understand (comprehension) =====
      { id: "understand-explain", pool: "understand", icon: "sliders",
        root: "Explain ",
        stems: ["a concept I'm stuck on, in plain terms", "this topic the way a beginner needs",
                "an idea, and ask me how deep to go", "something from my reading without the jargon"] },
      { id: "understand-summarise", pool: "understand", icon: "zoomIn",
        root: "Summarise ",
        stems: ["a long reading I'll paste, from one line to full detail", "these notes into the key points",
                "a chapter so I can decide what to read closely", "a dense passage without losing the argument"] },
      { id: "understand-connect", pool: "understand", icon: "venn",
        root: "Help me connect ",
        stems: ["a new idea to something I already know", "two topics I'm studying",
                "this theory to a real example", "last week's material to this week's"] },
      // distinct AT pattern (TextHelp Vocabulary List), woven into Understand
      { id: "at-vocab", pool: "understand", icon: "bookText", tags: ["assistive"],
        text: "Pull every tricky term from a text into a table: term, plain-English meaning, and an example from my subject. I'll paste the text." },

      // ===== Transform (representation) =====
      { id: "transform-reshape", pool: "transform", icon: "table",
        root: "Turn ",
        stems: ["these notes into a clear table", "this text into ordered steps",
                "a paragraph into a checklist", "this information into a comparison"] },
      // category 9 reading support IS an AT pattern -> tagged (double duty)
      { id: "transform-reading", pool: "transform", icon: "bookOpenText", tags: ["assistive"],
        root: "Help me get through this reading: ",
        stems: ["break it into chunks I can follow", "explain each section as I go",
                "point me to the parts that matter most", "give me a plain-language version alongside"] },
      // distinct AT pattern (TextHelp Simplify AI), woven into Transform
      { id: "at-simplify", pool: "transform", icon: "universalAccess", tags: ["assistive"],
        root: "Rewrite something in shorter sentences and common words, keeping every fact: ",
        stems: ["a dense paragraph I'll paste", "a passage I can't parse",
                "an email that's hard to follow", "text at an easier reading level"] },
      { id: "transform-image", pool: "transform", icon: "image",
        text: "Describe what's in an image I'll attach.",
        requires: ["image"], action: "attach" },

      // ===== Organise (regulation) =====
      // category 11 breakdown IS the Magic ToDo pattern -> tagged (double duty)
      { id: "organise-breakdown", pool: "organise", icon: "listNumbered", tags: ["assistive"],
        root: "Break ",
        stems: ["a big assignment into small steps", "this task into a checklist",
                "a task into steps sized to how overwhelming it feels", "a project into manageable stages"] },
      // category 12 task initiation IS an AT pattern -> tagged (double duty)
      { id: "organise-firststep", pool: "organise", icon: "lightning", tags: ["assistive"],
        root: "I'm stuck starting ",
        stems: ["an essay — give me only the first tiny step", "revision — just the first thing to do",
                "a task I've been avoiding — one small step", "this work — the smallest possible start"] },
      { id: "organise-metacognition", pool: "organise", icon: "brain",
        root: "Help me reflect on ",
        stems: ["how I revised and what I'd change", "where my time actually went this week",
                "what worked in my last assignment", "how I learn this kind of material best"] },
      // distinct AT pattern (Goblin.Tools Estimator), woven into Organise
      { id: "at-estimate", pool: "organise", icon: "hourglass", tags: ["assistive"],
        text: "Estimate how long each step of a task really takes, total it, and add a buffer. I'll paste the steps." },
      // distinct AT pattern (Goblin.Tools Compiler), woven into Organise
      { id: "at-compiler", pool: "organise", icon: "inbox", tags: ["assistive"],
        text: "Here's everything in my head, in no order. Sort it into actions, things to ask someone, and things to ignore for now." },
      // distinct AT pattern (Motion-style replan), woven into Organise
      { id: "at-replan", pool: "organise", icon: "calendarMove", tags: ["assistive"],
        text: "Replan my day when something slips. I'll paste what's left and what happened." },

      // ===== Practise (consolidation) =====
      // category 14 quiz IS the Glean Quiz Me pattern -> tagged (double duty)
      { id: "practise-quiz", pool: "practise", icon: "target", tags: ["assistive"],
        root: "Quiz me on ",
        stems: ["a topic, one question at a time", "my revision, and keep my score",
                "this subject and show me where I'm weak", "material I'll name, at my own pace"] },
      { id: "practise-feedback", pool: "practise", icon: "messageSquare",
        root: "Give me feedback on ",
        stems: ["a draft against a rubric I'll paste", "my writing's structure",
                "an answer before I submit it", "this paragraph's clarity"] },
      { id: "practise-revision", pool: "practise", icon: "calendarDays",
        root: "Help me plan my revision for ",
        stems: ["an exam I'll name, across the time I have", "a subject I've fallen behind on",
                "several deadlines at once", "topics spaced over the coming weeks"] },
      // distinct AT pattern (Scholarcy-style paper flashcards), woven into Practise
      { id: "at-flashcards", pool: "practise", icon: "pdf", tags: ["assistive"],
        text: "Make revision flashcards from a paper I'll attach: one claim per card, question on the front, answer on the back.",
        requires: ["pdf"], action: "attach" },

      // ===== Create (composition) =====
      { id: "create-brainstorm", pool: "create", icon: "lightbulbOn",
        root: "Brainstorm ",
        stems: ["ideas for an assignment I'll describe", "angles on a topic with me",
                "variations on my half-formed idea", "options when I'm stuck for a direction"] },
      { id: "create-research", pool: "create", icon: "compass",
        root: "Help me get oriented in ",
        stems: ["a topic that's new to me", "an unfamiliar field before I read deeply",
                "the key debates on a question I'll give you", "where to start reading about this"] },
      { id: "create-structure", pool: "create", icon: "books",
        root: "Help me structure ",
        stems: ["a piece of writing from points in any order", "an essay around my argument",
                "a report I need to plan", "my ideas into a clear outline"] },
      { id: "create-code", pool: "create", icon: "code",
        root: "Explain ",
        stems: ["a coding error like I'm new to it", "what this code does, step by step",
                "why my code isn't working", "a programming concept simply"] },
      // distinct AT pattern (Glean AI Outlines), woven into Create
      { id: "at-outline", pool: "create", icon: "documentList", tags: ["assistive"],
        text: "Turn my notes into a structured outline, keeping anything I marked important. I'll paste them." },

      // ===== Communicate (expression) =====
      { id: "communicate-language", pool: "communicate", icon: "translate",
        root: "Rephrase ",
        stems: ["this in clearer English, keeping my meaning", "a sentence I'm struggling with",
                "this more formally without changing my point", "my writing so it reads more smoothly"] },
      { id: "communicate-tone", pool: "communicate", icon: "mail",
        root: "Help me write ",
        stems: ["an email in the right tone — tell me who it's to", "a message to a tutor I'm nervous about",
                "a polite chaser for something overdue", "a clear request to staff"] },
      { id: "communicate-career", pool: "communicate", icon: "briefcase",
        root: "Help me prepare ",
        stems: ["for a job interview, with practice questions", "a CV I'll paste for feedback",
                "answers to competency questions", "to talk about my skills with confidence"] },
      { id: "communicate-studyskills", pool: "communicate", icon: "rocket",
        root: "Help me build ",
        stems: ["a study routine I'll actually stick to", "momentum on a task I've been dreading",
                "a realistic plan for a heavy week", "focus habits that suit how I work"] },
      // distinct AT pattern (Goblin.Tools Judge), woven into Communicate
      { id: "at-judge", pool: "communicate", icon: "speechBubble", tags: ["assistive"],
        text: "Read a message I received and tell me its likely tone, and what it's actually asking me to do." },
    ],
  };
})();
