// Synchronous accessors over the generated asset maps. Hand-written (not
// generated): the *.js siblings here are pure data produced by
// tools/build-assets.mjs. No fetch, no fs — assets are baked in at import time.

import { fonts } from "./fonts.js";
import { css } from "./css.js";
import { templates } from "./templates.js";
import { scripts } from "./scripts.js";

export { fonts, css, templates, scripts };

function getter(map, label) {
  return (key) => {
    if (!Object.prototype.hasOwnProperty.call(map, key)) {
      throw new Error(`scorm-builder: asset not found in ${label}: "${key}". Available: ${Object.keys(map).join(", ")}`);
    }
    return map[key];
  };
}

export const getFont = getter(fonts, "fonts");
export const getCss = getter(css, "css");
export const getTemplate = getter(templates, "templates");
export const getScript = getter(scripts, "scripts");

export function hasFont(key) { return Object.prototype.hasOwnProperty.call(fonts, key); }
export function hasCss(key) { return Object.prototype.hasOwnProperty.call(css, key); }
export function hasTemplate(key) { return Object.prototype.hasOwnProperty.call(templates, key); }
export function hasScript(key) { return Object.prototype.hasOwnProperty.call(scripts, key); }

// Concatenate every CSS asset (optionally filtered) into one string for <style> embedding.
export function allCss(filter = () => true) {
  return Object.keys(css)
    .filter(filter)
    .sort()
    .map((key) => `/* ${key} */\n${css[key]}`)
    .join("\n\n");
}
