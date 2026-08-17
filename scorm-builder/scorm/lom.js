// IEEE LOM generation. Feeds BOTH metadata.xml and the inline <lom> block in
// imsmanifest.xml — from one normaliseLom() call, so the two cannot diverge.
//
// Originally ported from scorm-export-manager.js generateSCORMMetadata + its
// description helpers (~lines 180-414), genericised and made deterministic
// (identifier + date injected). Widened in P1f to a general-purpose LOM emitter:
// it speaks LOM, and any host vocabulary ("ug3", "solution-sheet") is the host's
// job to translate before it gets here. See docs/lom-mapping-design.md.
//
// Three rules govern every line below.
//
//   1. BYTE-IDENTITY. Supplying none of the new keys must reproduce the previous
//      output exactly — same elements, same order, same indentation. Every
//      addition is emitted only when its input is present. tools/verify-change.mjs
//      enforces this against a recorded golden.
//
//   2. DROP AND WARN, NEVER THROW, NEVER EMIT AN INVALID TOKEN. The strict
//      binding (vocab/strict.xsd) enumerates <source> to "LOMv1.0" alone, so
//      there is no schema-valid way to invent a vocabulary token — anything
//      outside LOM_VOCABULARIES must land in free text (classification /
//      taxonPath / keyword) instead. A metadata typo must not fail an export,
//      and it must not ship invalid XML either. Everything dropped goes through
//      opts.onWarning so a host can surface it.
//
//      Precisely: an invalid entry in a LIST is dropped on its own; an invalid
//      scalar with no library default omits its element; an invalid scalar that
//      DOES have a library default (cost, copyrightAndOtherRestrictions) falls
//      back to that default rather than losing the element entirely.
//
//   3. INLINING PUTS THIS UNDER THE MANIFEST'S STRICT WILDCARD. imscp_v1p1.xsd
//      (3rd Edition) uses processContents="strict", so once the LOM is inlined
//      any LOM defect is also a MANIFEST defect. Both artefacts are validated by
//      test/unit/scorm-xsd.test.js and by `npm run verify`.
//
// Section objects may use either `.title` (legacy) or `.text` (this library's
// metadata-provider) — sectionTitle() normalises both.

import { escapeXML } from "../util/escape-xml.js";
import { resolveConfig } from "./config.js";

export const LOM_NAMESPACE = "http://ltsc.ieee.org/xsd/LOM";

// The historical hard-coded five. Exported so a caller can subset them without
// copying string literals: keywords: [...DEFAULT_LOM_KEYWORDS.filter(...), "chemistry"].
// Two of them (MathJax, WCAG) describe the delivery mechanism rather than the
// content — pass `keywords` to replace the set, or `keywords: []` to opt out.
export const DEFAULT_LOM_KEYWORDS = Object.freeze([
  "accessibility",
  "mathematics",
  "MathJax",
  "WCAG",
  "screen reader",
]);

// The complete LOMv1.0 token lists, transcribed from the enumerations in the
// vendored common/vocabValues.xsd — not from memory, and not from the LOM data
// model prose. Exported so callers and tests can introspect them.
// Keys are element names; `requirementType`/`requirementName` disambiguate
// 4.4.1.1 <type> and 4.4.1.2 <name>, whose element names are too generic.
export const LOM_VOCABULARIES = Object.freeze({
  structure: Object.freeze(["atomic", "collection", "networked", "hierarchical", "linear"]),
  aggregationLevel: Object.freeze(["1", "2", "3", "4"]),
  status: Object.freeze(["draft", "final", "revised", "unavailable"]),
  role: Object.freeze([
    "author", "publisher", "unknown", "initiator", "terminator", "validator", "editor",
    "graphical designer", "technical implementer", "content provider", "technical validator",
    "educational validator", "script writer", "instructional designer", "subject matter expert",
  ]),
  requirementType: Object.freeze(["operating system", "browser"]),
  requirementName: Object.freeze([
    "pc-dos", "ms-windows", "macos", "unix", "multi-os", "none", "any",
    "netscape communicator", "ms-internet explorer", "opera", "amaya",
  ]),
  interactivityType: Object.freeze(["active", "expositive", "mixed"]),
  learningResourceType: Object.freeze([
    "exercise", "simulation", "questionnaire", "diagram", "figure", "graph", "index", "slide",
    "table", "narrative text", "exam", "experiment", "problem statement", "self assessment",
    "lecture",
  ]),
  interactivityLevel: Object.freeze(["very low", "low", "medium", "high", "very high"]),
  semanticDensity: Object.freeze(["very low", "low", "medium", "high", "very high"]),
  intendedEndUserRole: Object.freeze(["teacher", "author", "learner", "manager"]),
  context: Object.freeze(["school", "higher education", "training", "other"]),
  difficulty: Object.freeze(["very easy", "easy", "medium", "difficult", "very difficult"]),
  cost: Object.freeze(["yes", "no"]),
  copyrightAndOtherRestrictions: Object.freeze(["yes", "no"]),
  purpose: Object.freeze([
    "discipline", "idea", "prerequisite", "educational objective", "accessibility restrictions",
    "educational level", "skill level", "security level", "competency",
  ]),
});

// xs:language lexical space (RFC 3066 / BCP 47 SYNTAX — not a registry check).
// `en`, `cy`, `en-GB`, `pt-BR` all pass; there is no case constraint.
const LANGUAGE_RE = /^[a-zA-Z]{1,8}(-[a-zA-Z0-9]{1,8})*$/;

// DateTimeString, restricted to the date-only forms. The full pattern nests the
// timezone group INSIDE the fractional-seconds group, so `2026-07-25T13:45:00Z`
// — an ordinary ISO 8601 instant — does NOT validate. Emitting date-only
// sidesteps that entirely and matches the reference samples.
const DATE_RE = /^(?!0000)\d{4}(-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?)?$/;

// DurationString, from common/dataTypes.xsd.
const DURATION_RE = /^P(\d+Y)?(\d+M)?(\d+D)?(T(\d+H)?(\d+M)?(\d+(\.\d+)?S)?)?$/;

const DEFAULT_INSTALLATION_REMARKS =
  "Requires JavaScript-enabled browser. MathJax CDN recommended for optimal rendering.";

const sectionTitle = (s) => (s && (s.title || s.text)) || "";

function numberToWord(num) {
  const words = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
  if (num >= 0 && num <= 9 && Number.isInteger(num)) return words[num];
  return num.toString();
}

function formatSectionList(sections, maxShow = 3) {
  if (!sections || sections.length === 0) return "";
  const titles = sections.map((s) => `"${sectionTitle(s)}"`);
  const count = titles.length;
  if (count === 1) return titles[0];
  if (count === 2) return `${titles[0]} and ${titles[1]}`;
  if (count <= maxShow) {
    const last = titles.pop();
    return `${titles.join(", ")}, and ${last}`;
  }
  const firstThree = titles.slice(0, maxShow);
  const last = firstThree.pop();
  return `starting with ${firstThree.join(", ")}, and ${last}`;
}

function analyseContentContext(metadata) {
  const title = (metadata.title || "").toLowerCase();
  const allSections = metadata.sections ? metadata.sections.map((s) => sectionTitle(s).toLowerCase()).join(" ") : "";
  const content = (title + " " + allSections).toLowerCase();

  if (content.match(/calculus|derivative|integral|limit|differential/)) return "calculus";
  if (content.match(/algebra|equation|polynomial|matrix|vector/)) return "algebra";
  if (content.match(/geometry|triangle|circle|angle|theorem/)) return "geometry";
  if (content.match(/statistics|probability|distribution|regression/)) return "statistics";
  if (content.match(/analysis|topology|metric|space|function/)) return "mathematical analysis";
  if (content.match(/number theory|prime|modular|arithmetic/)) return "number theory";
  if (content.match(/physics|quantum|mechanics|thermodynamics|electromagnetic/)) return "physics";
  if (content.match(/force|energy|momentum|wave|particle/)) return "physics";
  if (content.match(/engineering|circuit|signal|system|control/)) return "engineering";
  if (content.match(/algorithm|computer|programming|complexity|data structure/)) return "computer science";
  if (content.match(/chemistry|chemical|molecule|reaction|bond/)) return "chemistry";
  if (content.match(/science|research|experiment|theory|analysis/)) return "STEM";
  return null;
}

export function generateIntelligentDescription(metadata) {
  const title = metadata.title || "Document";
  const documentTitle = (metadata.title || "").trim();

  const actualSections = (metadata.sections || []).filter(
    (section) =>
      section &&
      sectionTitle(section).trim() !== "" &&
      sectionTitle(section).trim() !== documentTitle &&
      !sectionTitle(section).toLowerCase().includes("table of contents") &&
      !sectionTitle(section).toLowerCase().includes("abstract") &&
      (section.level === undefined || section.level > 0)
  );

  let description = "";
  if (actualSections.length > 0) {
    const sectionCount = actualSections.length;
    const sectionWord = sectionCount === 1 ? "section" : "sections";
    const formatted = formatSectionList(actualSections);
    if (sectionCount >= 5) {
      description += `${title} with ${numberToWord(sectionCount)} ${sectionWord} ${formatted}`;
    } else {
      description += `${title} with ${numberToWord(sectionCount)} ${sectionWord}: ${formatted}`;
    }
    description += ". ";
  } else {
    description += `${title}. `;
  }

  const context = analyseContentContext(metadata);
  description += context ? `This ${context} material ` : "This material ";
  description += "may open in a new browser window or tab.";
  return description;
}

// ---------------------------------------------------------------------------
// Normalisation — validate once, warn once, produce plain data
// ---------------------------------------------------------------------------

const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

/** Free text, or null when there is nothing meaningful there. Numbers stringify. */
const text = (v) => {
  if (v == null) return null;
  const s = String(v);
  return s.trim() ? s : null;
};

/** vCard text-value escaping (RFC 2426 §2.4.2). Backslash first, or it re-escapes. */
function vcardEscape(value) {
  return String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|[\r\n]/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function makeWarn(onWarning) {
  if (typeof onWarning !== "function") return () => {};
  return (code, detail) => onWarning({ code, ...detail });
}

/** A single vocabulary token. Returns null (and warns) if it is not in the list. */
function vocabToken(warn, element, value, key = element) {
  const allowed = LOM_VOCABULARIES[key];
  const v = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!v) return null;
  if (allowed.includes(v)) return v;
  warn("lom-invalid-vocabulary", { element, value: v, allowed });
  return null;
}

/**
 * A repeatable vocabulary element. `undefined`/`null` keeps the library default;
 * anything else REPLACES it, with invalid entries dropped individually — so an
 * explicit `[]` is a genuine opt-out and `["nonsense"]` yields no element.
 */
function vocabList(warn, element, value, fallback = [], key = element) {
  if (value == null) return fallback;
  return asList(value)
    .map((v) => vocabToken(warn, element, v, key))
    .filter(Boolean);
}

function patterned(warn, code, re, element, value) {
  const v = text(value);
  if (!v) return null;
  if (re.test(v.trim())) return v.trim();
  warn(code, { element, value: v });
  return null;
}

/** xs:language syntax check. Invalid input warns and yields `fallback`. */
function normaliseLanguage(warn, element, value, fallback = null) {
  const v = text(value);
  if (!v) return fallback;
  if (LANGUAGE_RE.test(v.trim())) return v.trim();
  warn("lom-invalid-language", { element, value: v.trim(), fallback });
  return fallback;
}

/**
 * Build a vCard 2.1 for contribute.entity, matching the shape of ADL's own
 * reference sample rather than RFC 2426. `FN` is present so the name is
 * machine-readable; `N` is deliberately NOT fabricated — splitting a free-text
 * name into family/given is a guess, and a wrong N is worse than an absent one.
 * Callers needing strict RFC 2426 pass a complete vCard string, emitted verbatim.
 * LF line endings: XML parsing normalises CRLF to LF, so CRLF cannot survive the
 * round trip and pretending otherwise is theatre.
 */
function normaliseEntity(entity) {
  if (!entity) return null;
  if (typeof entity === "string") return entity.trim() ? entity : null;

  const name = text(entity.name);
  const org = text(entity.org);
  const email = text(entity.email);
  if (!name && !org && !email) return null;

  const lines = ["BEGIN:VCARD", "VERSION:2.1"];
  if (name) lines.push(`FN:${vcardEscape(name)}`);
  if (org) lines.push(`ORG:${vcardEscape(org)}`);
  if (email) lines.push(`EMAIL;INTERNET:${vcardEscape(email)}`);
  lines.push("END:VCARD");
  return lines.join("\n");
}

function normaliseContributes(metadata, warn) {
  // An explicit `contributors` list wins outright: explicit beats derived, and
  // silently appending a legacy `author` to a caller's curated list would be
  // surprising. Callers using `contributors` supply their own author entry.
  const explicit = asList(metadata.contributors);
  const source = explicit.length
    ? explicit
    : metadata.author || metadata.date
      ? [{ role: "author", entity: metadata.author ? { name: metadata.author } : null, date: metadata.date }]
      : [];

  return source
    .map((c) => {
      if (!c) return null;
      const entry = {
        role: vocabToken(warn, "role", c.role),
        entity: normaliseEntity(c.entity),
        date: patterned(warn, "lom-invalid-date", DATE_RE, "date", c.date),
      };
      return entry.role || entry.entity || entry.date ? entry : null;
    })
    .filter(Boolean);
}

function normaliseTaxonPaths(value) {
  return asList(value)
    .map((path) => {
      if (!path) return null;
      const taxons = asList(path.taxons || path.taxon)
        .map((t) => (t ? { id: text(t.id), entry: text(t.entry) } : null))
        .filter((t) => t && (t.id || t.entry));
      const source = text(path.source);
      return source || taxons.length ? { source, taxons } : null;
    })
    .filter(Boolean);
}

function normaliseClassifications(metadata, warn) {
  return asList(metadata.classification)
    .map((c) => {
      if (!c) return null;
      const entry = {
        purpose: vocabToken(warn, "purpose", c.purpose),
        taxonPaths: normaliseTaxonPaths(c.taxonPath || c.taxonPaths),
        description: text(c.description),
        keywords: asList(c.keywords).map(text).filter(Boolean),
      };
      return entry.purpose || entry.taxonPaths.length || entry.description || entry.keywords.length
        ? entry
        : null;
    })
    .filter(Boolean);
}

function normaliseKeywords(metadata) {
  // undefined/null -> the default five; anything else replaces them. addKeywords
  // appends to whichever set is in force. Blank entries are a normal artefact of
  // an empty host field, so they are dropped silently rather than warned about.
  const base = metadata.keywords == null ? DEFAULT_LOM_KEYWORDS : asList(metadata.keywords);
  const seen = new Set();
  const out = [];
  for (const raw of [...base, ...asList(metadata.addKeywords)]) {
    const k = text(raw);
    if (!k || !k.trim()) continue;
    const key = k.trim().toLowerCase();
    if (seen.has(key)) continue; // first occurrence wins
    seen.add(key);
    out.push(k);
  }
  return out;
}

/**
 * Validate and normalise metadata into a plain, render-ready LOM model.
 * Call this ONCE and render it as many times as needed — that is what keeps
 * metadata.xml and the inline manifest block from drifting apart.
 *
 * @param {object} metadata - see docs/lom-mapping-design.md §8.2 for the full shape
 * @param {object} [opts]
 * @param {string} [opts.identifier] - LOM identifier entry (inject for determinism)
 * @param {object} [opts.config] - SCORM config overrides
 * @param {string} [opts.language] - document language; also the default @language
 *   on every LangString. Falls back to "en" (with a warning) if it is not valid
 *   xs:language syntax.
 * @param {(warning:{code:string}) => void} [opts.onWarning] - dropped/invalid input
 * @returns {object} a render-ready model
 */
export function normaliseLom(metadata = {}, opts = {}) {
  resolveConfig(opts.config); // reserved for future config-driven fields
  const meta = metadata || {};
  const warn = makeWarn(opts.onWarning);

  const language = normaliseLanguage(warn, "language", opts.language, "en");
  const identifier = opts.identifier || `scorm_lom_${Date.now()}`;
  const edu = meta.educational || {};
  const tech = meta.technical || {};
  const rights = meta.rights || {};

  return {
    language,
    general: {
      identifiers: [
        { catalog: "URI", entry: identifier },
        ...asList(meta.identifiers)
          .map((i) => (i ? { catalog: text(i.catalog), entry: text(i.entry) } : null))
          .filter((i) => i && (i.catalog || i.entry)),
      ],
      title: text(meta.title) || "Accessible Document",
      description: text(meta.description) || generateIntelligentDescription(meta),
      keywords: normaliseKeywords(meta),
      coverage: text(meta.coverage),
      structure: vocabToken(warn, "structure", meta.structure),
      aggregationLevel: vocabToken(warn, "aggregationLevel", meta.aggregationLevel),
    },
    lifeCycle: {
      version: text(meta.version),
      status: vocabToken(warn, "status", meta.status),
      contributes: normaliseContributes(meta, warn),
    },
    technical: {
      installationRemarks:
        tech.installationRemarks == null ? DEFAULT_INSTALLATION_REMARKS : text(tech.installationRemarks),
      otherPlatformRequirements: text(tech.otherPlatformRequirements),
      duration: patterned(warn, "lom-invalid-duration", DURATION_RE, "technical.duration", tech.duration),
    },
    educational: {
      interactivityType: vocabToken(warn, "interactivityType", edu.interactivityType),
      // "lecture" is an UNEVIDENCED default — it is asserted about content this
      // library has never inspected, and is wrong for most handouts and papers.
      // It is kept only because "no new fields -> byte-identical output" is a
      // testable invariant worth more than a vocabulary token nothing reads
      // (Moodle reads no LOM at all). Hosts should override it.
      learningResourceType: vocabList(warn, "learningResourceType", edu.learningResourceType, ["lecture"]),
      interactivityLevel: vocabToken(warn, "interactivityLevel", edu.interactivityLevel),
      semanticDensity: vocabToken(warn, "semanticDensity", edu.semanticDensity),
      intendedEndUserRole: vocabList(warn, "intendedEndUserRole", edu.intendedEndUserRole, ["learner", "teacher"]),
      context: vocabList(warn, "context", edu.context, ["higher education"]),
      typicalAgeRange: text(edu.typicalAgeRange),
      difficulty: vocabToken(warn, "difficulty", edu.difficulty),
      typicalLearningTime: patterned(
        warn, "lom-invalid-duration", DURATION_RE, "educational.typicalLearningTime", edu.typicalLearningTime
      ),
      description: text(edu.description),
      // Opt-in only. Defaulting it to `language` would break byte-identity for
      // every existing caller for no gain — 1.3 already states the object's
      // language, and 5.11 means something subtly different.
      language: normaliseLanguage(warn, "educational.language", edu.language),
    },
    rights: {
      // These two have library defaults, so an invalid token falls back rather
      // than dropping the element (see rule 2 in the header).
      cost: (rights.cost == null ? null : vocabToken(warn, "cost", rights.cost)) || "no",
      copyrightAndOtherRestrictions:
        (rights.copyrightAndOtherRestrictions == null
          ? null
          : vocabToken(warn, "copyrightAndOtherRestrictions", rights.copyrightAndOtherRestrictions)) || "yes",
      description: text(rights.description),
    },
    classifications: normaliseClassifications(meta, warn),
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

/**
 * Render the model as a `<lom>` element, every line prefixed by `indent` spaces.
 *
 * `indent` is applied while building rather than by reindenting afterwards, on
 * purpose: a vCard `<entity>` carries literal newlines and its continuation
 * lines MUST start at column 0 — a leading space is a vCard folding marker and
 * would corrupt the value.
 *
 * The default namespace is declared on `<lom>` itself, so the same output works
 * standalone and nested inside the manifest's `<metadata>` without the manifest
 * root having to declare anything.
 *
 * @param {object} model - from normaliseLom()
 * @param {number} [indent=0] - base indentation in spaces
 * @returns {string}
 */
export function renderLomFragment(model, indent = 0) {
  const p = (depth) => " ".repeat(indent + depth * 2);
  const lang = model.language;

  const esc = (s) => escapeXML(String(s));
  // A LangString on one line — the compact form, used for repeatable/optional fields.
  const ls = (depth, tag, value) => `${p(depth)}<${tag}><string language="${lang}">${esc(value)}</string></${tag}>`;
  // A LangString over three lines — the historical form for title/description/installationRemarks.
  const lsBlock = (depth, tag, value) => [
    `${p(depth)}<${tag}>`,
    `${p(depth + 1)}<string language="${lang}">${esc(value)}</string>`,
    `${p(depth)}</${tag}>`,
  ];
  const vocab = (depth, tag, value) =>
    `${p(depth)}<${tag}><source>LOMv1.0</source><value>${esc(value)}</value></${tag}>`;

  const g = model.general;
  const general = [`${p(1)}<general>`];
  for (const id of g.identifiers) {
    general.push(`${p(2)}<identifier>`);
    if (id.catalog) general.push(`${p(3)}<catalog>${esc(id.catalog)}</catalog>`);
    if (id.entry) general.push(`${p(3)}<entry>${esc(id.entry)}</entry>`);
    general.push(`${p(2)}</identifier>`);
  }
  general.push(...lsBlock(2, "title", g.title));
  general.push(`${p(2)}<language>${esc(lang)}</language>`);
  general.push(...lsBlock(2, "description", g.description));
  for (const k of g.keywords) general.push(ls(2, "keyword", k));
  if (g.coverage) general.push(ls(2, "coverage", g.coverage));
  if (g.structure) general.push(vocab(2, "structure", g.structure));
  if (g.aggregationLevel) general.push(vocab(2, "aggregationLevel", g.aggregationLevel));
  general.push(`${p(1)}</general>`);

  const lc = model.lifeCycle;
  const lifeCycle = [];
  if (lc.version || lc.status || lc.contributes.length) {
    lifeCycle.push(`${p(1)}<lifeCycle>`);
    if (lc.version) lifeCycle.push(ls(2, "version", lc.version));
    if (lc.status) lifeCycle.push(vocab(2, "status", lc.status));
    for (const c of lc.contributes) {
      lifeCycle.push(`${p(2)}<contribute>`);
      if (c.role) lifeCycle.push(vocab(3, "role", c.role));
      // Literal newlines, continuation lines unindented — see the note above.
      if (c.entity) lifeCycle.push(`${p(3)}<entity>${esc(c.entity)}</entity>`);
      if (c.date) {
        lifeCycle.push(`${p(3)}<date>`, `${p(4)}<dateTime>${esc(c.date)}</dateTime>`, `${p(3)}</date>`);
      }
      lifeCycle.push(`${p(2)}</contribute>`);
    }
    lifeCycle.push(`${p(1)}</lifeCycle>`);
  }

  const t = model.technical;
  const technical = [
    `${p(1)}<technical>`,
    `${p(2)}<format>text/html</format>`,
    `${p(2)}<requirement>`,
    `${p(3)}<orComposite>`,
    `${p(4)}<type><source>LOMv1.0</source><value>browser</value></type>`,
    `${p(4)}<name><source>LOMv1.0</source><value>any</value></name>`,
    `${p(4)}<minimumVersion>HTML5</minimumVersion>`,
    `${p(3)}</orComposite>`,
    `${p(2)}</requirement>`,
  ];
  if (t.installationRemarks) technical.push(...lsBlock(2, "installationRemarks", t.installationRemarks));
  if (t.otherPlatformRequirements) technical.push(ls(2, "otherPlatformRequirements", t.otherPlatformRequirements));
  if (t.duration) {
    technical.push(`${p(2)}<duration><duration>${esc(t.duration)}</duration></duration>`);
  }
  technical.push(`${p(1)}</technical>`);

  // Child order follows the schema's listing order (5.1 .. 5.11). It is not
  // significant — every LOM container is an xs:choice — but a stable canonical
  // order is what makes byte-identity testable.
  const e = model.educational;
  const educational = [`${p(1)}<educational>`];
  if (e.interactivityType) educational.push(vocab(2, "interactivityType", e.interactivityType));
  for (const v of e.learningResourceType) educational.push(vocab(2, "learningResourceType", v));
  if (e.interactivityLevel) educational.push(vocab(2, "interactivityLevel", e.interactivityLevel));
  if (e.semanticDensity) educational.push(vocab(2, "semanticDensity", e.semanticDensity));
  for (const v of e.intendedEndUserRole) educational.push(vocab(2, "intendedEndUserRole", v));
  for (const v of e.context) educational.push(vocab(2, "context", v));
  if (e.typicalAgeRange) educational.push(ls(2, "typicalAgeRange", e.typicalAgeRange));
  if (e.difficulty) educational.push(vocab(2, "difficulty", e.difficulty));
  if (e.typicalLearningTime) {
    educational.push(`${p(2)}<typicalLearningTime><duration>${esc(e.typicalLearningTime)}</duration></typicalLearningTime>`);
  }
  if (e.description) educational.push(...lsBlock(2, "description", e.description));
  if (e.language) educational.push(`${p(2)}<language>${esc(e.language)}</language>`);
  educational.push(`${p(1)}</educational>`);

  const r = model.rights;
  const rightsLines = [
    `${p(1)}<rights>`,
    vocab(2, "cost", r.cost),
    vocab(2, "copyrightAndOtherRestrictions", r.copyrightAndOtherRestrictions),
  ];
  if (r.description) rightsLines.push(...lsBlock(2, "description", r.description));
  rightsLines.push(`${p(1)}</rights>`);

  // classification carries everything with no LOM vocabulary home (module codes,
  // "ug3", "Solution sheet") as standards-correct free text. Emitted last, which
  // also keeps its <description> after general.description in document order.
  const classifications = model.classifications.map((c) => {
    const out = [`${p(1)}<classification>`];
    if (c.purpose) out.push(vocab(2, "purpose", c.purpose));
    for (const path of c.taxonPaths) {
      out.push(`${p(2)}<taxonPath>`);
      if (path.source) out.push(ls(3, "source", path.source));
      for (const taxon of path.taxons) {
        out.push(`${p(3)}<taxon>`);
        if (taxon.id) out.push(`${p(4)}<id>${esc(taxon.id)}</id>`);
        if (taxon.entry) out.push(ls(4, "entry", taxon.entry));
        out.push(`${p(3)}</taxon>`);
      }
      out.push(`${p(2)}</taxonPath>`);
    }
    if (c.description) out.push(...lsBlock(2, "description", c.description));
    for (const k of c.keywords) out.push(ls(2, "keyword", k));
    out.push(`${p(1)}</classification>`);
    return out;
  });

  const body = [general, lifeCycle, technical, educational, rightsLines, ...classifications]
    .filter((s) => s.length)
    .map((s) => s.join("\n"))
    .join("\n\n");

  return `${p(0)}<lom xmlns="${LOM_NAMESPACE}">\n${body}\n${p(0)}</lom>`;
}

/** The standalone metadata.xml form: XML declaration + an unindented `<lom>`. */
export function renderLomDocument(model) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n${renderLomFragment(model, 0)}`;
}

/**
 * Normalise + render in one call — the back-compatible entry point.
 *
 * @param {object} metadata - see normaliseLom()
 * @param {object} [opts] - normaliseLom() opts, plus:
 * @param {"document"|"inline"} [opts.form="document"] - "inline" drops the XML
 *   declaration and indents to sit inside the manifest's `<metadata>`.
 * @param {number} [opts.indent] - override the inline indentation (default 4)
 * @returns {string} metadata.xml content, or an inline `<lom>` fragment
 */
export function generateLom(metadata = {}, opts = {}) {
  const model = normaliseLom(metadata, opts);
  if (opts.form === "inline") return renderLomFragment(model, opts.indent ?? 4);
  return renderLomDocument(model);
}
