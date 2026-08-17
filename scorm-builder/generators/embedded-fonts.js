// Render embedded-fonts.html into a <style> block with the six base64 WOFF2
// fonts inlined, so chosen fonts (OpenDyslexic, Atkinson Hyperlegible,
// Annotation Mono) work offline. Maps asset font keys -> template variables.

import { render } from "./template-engine.js";
import { getTemplate, getFont, hasFont } from "../assets/index.js";

export function renderEmbeddedFonts() {
  const context = {
    base64Regular: getFont("opendyslexic-regular"),
    base64Bold: getFont("opendyslexic-bold"),
    base64Italic: getFont("opendyslexic-italic"),
    base64BoldItalic: getFont("opendyslexic-bold-italic"),
    hasFontNameVariable: hasFont("AnnotationMono-VF"),
    fontNameVariableBase64: hasFont("AnnotationMono-VF") ? getFont("AnnotationMono-VF") : "",
    hasAtkinsonHyperlegible: hasFont("atkinson-hyperlegible-vf"),
    atkinsonHyperlegibleBase64: hasFont("atkinson-hyperlegible-vf") ? getFont("atkinson-hyperlegible-vf") : "",
  };
  return render(getTemplate("embedded-fonts.html"), context);
}
