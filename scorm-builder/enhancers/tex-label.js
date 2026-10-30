// Turn the TeX in a table header (or caption) into plain Unicode text, at build time, so the
// card layout's labels read "ϵ (relative permittivity)" rather than "$\epsilon$ (relative
// permittivity)". Pure string transform: no DOM, no dependency, same as enhance-tables.js.
//
// Scope is the maths that actually appears in table headers and captions (measured, RA-77
// arm 1): single letters, Greek letters, logic and arrow symbols, fractions, sub- and
// superscripts, \text{…}. Anything it does not know is NEVER left as raw TeX: the backslash,
// braces and delimiters are dropped and the name is kept (`\foo{x}` → `foo x`), and a sub- or
// superscript that has no Unicode form keeps its marker (`T_{eff}` → `T_eff`).

const SYMBOLS = Object.freeze({
  // Greek. \epsilon is the glyph TeX draws (U+03F5); \varepsilon is the curly one.
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ϵ", varepsilon: "ε", zeta: "ζ", eta: "η",
  theta: "θ", vartheta: "ϑ", iota: "ι", kappa: "κ", lambda: "λ", mu: "μ", nu: "ν", xi: "ξ", pi: "π",
  varpi: "ϖ", rho: "ρ", varrho: "ϱ", sigma: "σ", varsigma: "ς", tau: "τ", upsilon: "υ", phi: "ϕ",
  varphi: "φ", chi: "χ", psi: "ψ", omega: "ω",
  Gamma: "Γ", Delta: "Δ", Theta: "Θ", Lambda: "Λ", Xi: "Ξ", Pi: "Π", Sigma: "Σ", Upsilon: "Υ",
  Phi: "Φ", Psi: "Ψ", Omega: "Ω",
  // Logic, arrows, relations, operators.
  wedge: "∧", land: "∧", vee: "∨", lor: "∨", neg: "¬", lnot: "¬", forall: "∀", exists: "∃",
  Longrightarrow: "⟹", implies: "⟹", Rightarrow: "⇒", Leftarrow: "⇐", Longleftarrow: "⟸",
  Leftrightarrow: "⇔", Longleftrightarrow: "⟺", iff: "⟺", to: "→", rightarrow: "→", longrightarrow: "⟶",
  leftarrow: "←", leftrightarrow: "↔", mapsto: "↦",
  times: "×", cdot: "⋅", div: "÷", pm: "±", mp: "∓", leq: "≤", le: "≤", geq: "≥", ge: "≥", neq: "≠",
  ne: "≠", approx: "≈", equiv: "≡", sim: "∼", propto: "∝", ll: "≪", gg: "≫", in: "∈", notin: "∉",
  subset: "⊂", subseteq: "⊆", cup: "∪", cap: "∩", emptyset: "∅", infty: "∞", partial: "∂", nabla: "∇",
  sum: "∑", prod: "∏", int: "∫", circ: "°", degree: "°", ldots: "…", cdots: "⋯", dots: "…",
  prime: "′", angle: "∠", perp: "⊥", parallel: "∥", therefore: "∴", because: "∵",
  // Escaped characters and spacing commands.
  "%": "%", "$": "$", "&": "&", "#": "#", "_": "_", "{": "{", "}": "}",
  ",": " ", ";": " ", ":": " ", "!": "", " ": " ", quad: " ", qquad: " ",
});

// Commands that just wrap their argument.
const WRAPPERS = new Set([
  "text", "textbf", "textit", "textrm", "mathrm", "mathbf", "mathit", "mathsf", "mathtt",
  "mathcal", "operatorname", "boldsymbol", "bm", "hbox", "mbox", "emph", "overline", "underline",
  "hat", "bar", "vec", "tilde", "dot", "ddot",
]);

// Commands that take no argument and print nothing.
const SILENT = new Set(["left", "right", "big", "Big", "bigg", "Bigg", "displaystyle", "textstyle", "limits", "nolimits"]);

const BLACKBOARD = Object.freeze({ R: "ℝ", Z: "ℤ", N: "ℕ", Q: "ℚ", C: "ℂ" });

const SUPERSCRIPT = Object.freeze({
  0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ", "°": "°", "′": "′",
});

const SUBSCRIPT = Object.freeze({
  0: "₀", 1: "₁", 2: "₂", 3: "₃", 4: "₄", 5: "₅", 6: "₆", 7: "₇", 8: "₈", 9: "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
  a: "ₐ", e: "ₑ", h: "ₕ", i: "ᵢ", j: "ⱼ", k: "ₖ", l: "ₗ", m: "ₘ", n: "ₙ", o: "ₒ", p: "ₚ", r: "ᵣ",
  s: "ₛ", t: "ₜ", u: "ᵤ", v: "ᵥ", x: "ₓ",
});

// Read a balanced {…} group starting at s[i] === "{". Returns [rawInner, indexAfterClosingBrace].
function readGroup(s, i) {
  let depth = 0;
  for (let k = i; k < s.length; k += 1) {
    const ch = s[k];
    if (ch === "\\") { k += 1; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}") {
      depth -= 1;
      if (depth === 0) return [s.slice(i + 1, k), k + 1];
    }
  }
  return [s.slice(i + 1), s.length]; // unbalanced: take the rest
}

// Read one script argument after ^ or _: a {group}, a control word, or a single character.
function readAtom(s, i) {
  let k = i;
  while (s[k] === " ") k += 1;
  if (k >= s.length) return ["", k];
  if (s[k] === "{") return readGroup(s, k);
  if (s[k] === "\\") {
    const m = /^\\([A-Za-z]+|.)/s.exec(s.slice(k));
    if (!m) return ["", s.length]; // a lone trailing backslash
    return [m[0], k + m[0].length];
  }
  return [s[k], k + 1];
}

function mapAll(text, table) {
  const chars = [...text.replace(/\s+/g, "")];
  if (chars.length === 0) return "";
  return chars.every((c) => table[c] !== undefined) ? chars.map((c) => table[c]).join("") : null;
}

function wrapIfCompound(text) {
  return /[\s+\-−±]/.test(text.trim()) ? `(${text.trim()})` : text.trim();
}

function convert(s) {
  let out = "";
  let i = 0;
  while (i < s.length) {
    const ch = s[i];

    if (ch === "\\") {
      const m = /^\\([A-Za-z]+|.)/s.exec(s.slice(i));
      if (!m) break; // a lone trailing backslash prints nothing
      const name = m[1];
      i += m[0].length;

      if (name === "\\") { out += " "; continue; }
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        const [a, ia] = readAtom(s, i);
        const [b, ib] = readAtom(s, ia);
        i = ib;
        out += `${wrapIfCompound(convert(a))}/${wrapIfCompound(convert(b))}`;
        continue;
      }
      if (name === "sqrt") {
        let index = "";
        if (s[i] === "[") {
          const close = s.indexOf("]", i);
          if (close > i) { index = s.slice(i + 1, close); i = close + 1; }
        }
        const [a, ia] = readAtom(s, i);
        i = ia;
        const body = convert(a).trim();
        const root = index ? (mapAll(index, SUPERSCRIPT) || index) : "";
        out += `${root}√${/^\S$/.test(body) || /^\d+$/.test(body) ? body : `(${body})`}`;
        continue;
      }
      if (name === "mathbb") {
        const [a, ia] = readAtom(s, i);
        i = ia;
        out += BLACKBOARD[a.trim()] || convert(a);
        continue;
      }
      if (WRAPPERS.has(name)) {
        const [a, ia] = readAtom(s, i);
        i = ia;
        out += convert(a);
        continue;
      }
      if (SILENT.has(name)) continue;
      if (Object.prototype.hasOwnProperty.call(SYMBOLS, name)) { out += SYMBOLS[name]; continue; }

      // Unknown command: keep its name, then its argument (if braced) as plain text.
      out += name;
      if (s[i] === "{") {
        const [a, ia] = readGroup(s, i);
        i = ia;
        out += ` ${convert(a)}`;
      }
      continue;
    }

    if (ch === "^" || ch === "_") {
      const [arg, next] = readAtom(s, i + 1);
      i = next;
      const text = convert(arg).trim();
      const mapped = mapAll(text, ch === "^" ? SUPERSCRIPT : SUBSCRIPT);
      out += mapped !== null ? mapped : `${ch}${text}`;
      continue;
    }

    if (ch === "{" || ch === "}") { i += 1; continue; } // grouping braces print nothing
    if (ch === "~") { out += " "; i += 1; continue; }
    out += ch;
    i += 1;
  }
  return out;
}

/** Convert the inside of one maths span (delimiters already removed) to plain text. */
export function texToText(tex) {
  return convert(String(tex)).replace(/\s+/g, " ").trim();
}

const DELIMITED = [
  /\$\$([\s\S]+?)\$\$/g,
  /\\\(([\s\S]+?)\\\)/g,
  /\\\[([\s\S]+?)\\\]/g,
];

/**
 * Convert every `\( … \)`, `\[ … \]` and `$$ … $$` span inside plain text. A lone `$…$` is NOT
 * touched here: a header such as "Cost ($) or ($)" is not maths. Use texToText on the contents of
 * a markup-marked span (the enhancer does, for `<span class="math-inline">`).
 */
export function convertDelimited(text) {
  let s = String(text);
  for (const re of DELIMITED) s = s.replace(re, (_, inner) => texToText(inner));
  return s.replace(/\s+/g, " ").trim();
}

/** Remove the `$ … $` / `$$ … $$` delimiters MathPix leaves inside a math span, then convert. */
export function spanToText(spanText) {
  const t = String(spanText).trim();
  const m = /^\$\$([\s\S]*)\$\$$|^\$([\s\S]*)\$$|^\\\(([\s\S]*)\\\)$|^\\\[([\s\S]*)\\\]$/.exec(t);
  return texToText(m ? (m[1] ?? m[2] ?? m[3] ?? m[4]) : t);
}
