// imsmanifest.xml generation — SCORM 2004 3rd Edition.
// Ported from scorm-export-manager.js generateSCORMManifest (~line 113),
// genericised (no pandoc branding) and made deterministic: the package
// `identifier` is injected by the caller instead of `Date.now()`.
//
// Validated against the vendored 3rd Edition schemas by test/unit/scorm-xsd.test.js.
// Two things to know before editing the XML below:
//
//   * imscp_v1p1.xsd (IMS CP 1.1.3) admits foreign-namespace content with
//     processContents="strict", NOT lax. An element or attribute in a namespace
//     with no matching global declaration is therefore a hard validation error,
//     not something quietly skipped. That is why the ADL namespace URIs have to
//     be exactly right — they were previously bound to a fictional
//     `adltraining.com`, which made adlcp:scormType and adlcp:location invisible
//     to a namespace-aware consumer (a resource with no recognised scormType may
//     be treated as an untracked asset).
//   * resourceType is an xs:sequence — metadata?, file*, dependency*, any* — so
//     <metadata> MUST precede the <file> list. Child order matters here; inside
//     <item> it does not (that content goes through a trailing wildcard).

import { escapeXML } from "../util/escape-xml.js";
import { resolveConfig } from "./config.js";

/**
 * @param {object} metadata - { title, description? }
 * @param {object} [opts]
 * @param {string} [opts.identifier] - manifest identifier (inject for determinism)
 * @param {object} [opts.config] - SCORM config overrides
 * @param {string[]} [opts.files] - extra companion-file hrefs to declare in the SCO resource
 * @param {number|null} [opts.masteryScore] - pass threshold (percent) for a scored
 *   quiz. When set, and ONLY when set, emits <adlcp:masteryscore> as a 0..1
 *   fraction — see the note below. null/absent (content-only packages) emits
 *   nothing, which is the default path and validates clean.
 * @param {string} [opts.lom] - a pre-rendered inline LOM fragment (from
 *   renderLomFragment), indented to sit inside the top-level <metadata>. Omitted
 *   when absent, so direct callers of this function are unaffected.
 * @returns {string} imsmanifest.xml content
 */
export function generateManifest(metadata = {}, opts = {}) {
  const config = resolveConfig(opts.config);
  const identifier = opts.identifier || `scorm_${Date.now()}`;

  // ⚠ adlcp:masteryscore is NOT a SCORM 2004 element, and is emitted ONLY when a
  // mastery score is actually set. Do not make it unconditional again.
  //
  // adlcp_v1p3.xsd declares only location, dataFromLMS, timeLimitAction,
  // completionThreshold, data and map; masteryscore, prerequisites and
  // maxtimeallowed belong to SCORM 1.2 (adlcp_rootv1p2.xsd). imscp_v1p1.xsd
  // (IMS CP 1.1.3) admits foreign namespaces with processContents="strict", so
  // each one that IS emitted is a hard validation error.
  //
  // prerequisites and maxtimeallowed used to be emitted unconditionally and
  // ALWAYS EMPTY — three validation errors buying zero information between them.
  // Both are now gone. masteryscore survives conditionally because Moodle reads
  // it unconditionally (mod/scorm/datamodels/scormlib.php — the ADLCP:MASTERYSCORE
  // case is not gated on package version) and is the one LMS we have positive
  // evidence about; the standards-correct replacement is
  // <imsss:minNormalizedMeasure> inside a sequencing primary objective, which
  // this library does not yet emit. That is a scoring package of its own; see
  // docs/lom-mapping-design.md §1.4 and §12 Q6.
  //
  // Net effect: the DEFAULT export — every content-only package — now validates
  // with 0 errors. A scored quiz carries exactly one, pinned in
  // test/unit/scorm-xsd.test.js and in the verify `xsd-scored` check.
  //
  // The 0..1 fraction below follows the SCORM 1.2 masteryscore convention.
  const masteryElement =
    Number.isFinite(opts.masteryScore) && opts.masteryScore != null
      ? `\n        <adlcp:masteryscore>${String(
          Math.max(0, Math.min(1, opts.masteryScore / 100))
        )}</adlcp:masteryscore>`
      : "";

  // Inline LOM inside the top-level <metadata>, alongside the <adlcp:location>
  // pointer to the external metadata.xml. Both carry the same content, generated
  // from one normaliseLom() call in package-builder.js so they cannot diverge.
  // ADL's own reference template inlines it; nothing is documented as resolving
  // adlcp:location. See docs/lom-mapping-design.md §2.
  const inlineLom = opts.lom ? `\n${opts.lom}` : "";

  // Declare each bundled companion asset as a <file> in the SCO resource so
  // strict LMSes / SCORM Cloud validation accept and serve them.
  const extraFiles = (opts.files || [])
    .map((href) => `\n      <file href="${escapeXML(href)}"/>`)
    .join("");

  const title = escapeXML(metadata.title || "Accessible Document");
  const description = escapeXML(
    metadata.description ||
      "Accessible content with WCAG 2.2 AA support, screen reader compatibility, and interactive MathJax features."
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${identifier}" version="1.3"
          xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_v1p3"
          xmlns:adlseq="http://www.adlnet.org/xsd/adlseq_v1p3"
          xmlns:imsss="http://www.imsglobal.org/xsd/imsss"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsglobal.org/xsd/imscp_v1p1 imscp_v1p1.xsd
                              http://www.adlnet.org/xsd/adlcp_v1p3 adlcp_v1p3.xsd
                              http://www.adlnet.org/xsd/adlseq_v1p3 adlseq_v1p3.xsd
                              http://www.imsglobal.org/xsd/imsss imsss_v1p0.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>${config.SCHEMA_VERSION}</schemaversion>
    <adlcp:location>${config.METADATA_FILENAME}</adlcp:location>${inlineLom}
  </metadata>

  <organizations default="scorm_builder_org">
    <organization identifier="scorm_builder_org">
      <title>${title}</title>
      <item identifier="content_item" identifierref="resource_main_content">
        <title>${title}</title>${masteryElement}
        <adlcp:timeLimitAction>continue,no message</adlcp:timeLimitAction>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="resource_main_content" type="webcontent"
              adlcp:scormType="sco" href="${config.CONTENT_FILENAME}">
      <metadata>
        <adlcp:location>${config.METADATA_FILENAME}</adlcp:location>
      </metadata>
      <file href="${config.CONTENT_FILENAME}"/>
      <file href="${config.API_FILENAME}"/>${extraFiles}
    </resource>
  </resources>

</manifest>`;
}
