// Maths speech rules — the repairs put right on a COPY of an equation's MathML before the Speech
// Rule Engine (SRE) reads it, so what is spoken says what a listener needs. One plain-JS global,
// `window.MathsSpeechRules`, shared by every page that speaks maths: Read Aloud in an export
// (read-aloud.js) and, once it loads this file, the tools page. It holds no state, touches no
// DOM at load, and knows nothing of Read Aloud. The page's own MathML is never changed; the speech
// goes wherever the caller puts it (Read Aloud keeps it in data-read-aloud-speech, never aria-label).
//
//   MathsSpeechRules.forSpeech(math, domain)    -> { mathml, labels }
//   MathsSpeechRules.restoreLabels(speech, labels) -> speech
//
// Only ClearSpeak is repaired. Any other domain (MathSpeak) is passed through exactly as written.

window.MathsSpeechRules = (function () {
    // Maths speech (ClearSpeak): the MathML namespace for elements we add, the two capital
    // Deltas (upright, which ClearSpeak says "triangle"; italic, which it says "Delta"),
    // and the bracket pairs it drops around a single symbol.
    const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
    const CAPITAL_DELTA = "Δ";
    const ITALIC_CAPITAL_DELTA = "\u{1D6E5}";
    // A degree sign is written as a superscript ring (RING OPERATOR, or the degree sign itself).
    // ClearSpeak reads that as "raised to the composed with power".
    const DEGREE_RING_SIGNS = Object.freeze(["∘", "°"]);
    const DEGREE_SIGN = "°";
    // A dot between vectors is a dot product. MathJax writes \cdot as a DOT OPERATOR (U+22C5; a middle dot
    // U+00B7 is accepted too), which ClearSpeak reads "times". A vector is marked by an arrow or hat accent
    // (RIGHTWARDS ARROW, COMBINING RIGHT ARROW ABOVE; "^", MODIFIER LETTER CIRCUMFLEX), a bold letter, or nabla.
    const DOT_OPERATORS = Object.freeze(["⋅", "·"]);
    const DOT_WORD = "dot";
    const VECTOR_ACCENTS = Object.freeze(["→", "⃗", "^", "ˆ"]);
    const VECTOR_BOLD_VARIANTS = Object.freeze(["bold", "bold-italic"]);
    const NABLA = "∇";
    const VECTOR_SCRIPT_ELEMENTS = Object.freeze(["msub", "msup", "msubsup", "munder", "munderover"]);
    const DIFFERENTIAL_D = "d";
    const FLOOR_CEILING_BRACKETS = Object.freeze([
        Object.freeze({ open: "⌊", close: "⌋", name: "floor" }),
        Object.freeze({ open: "⌈", close: "⌉", name: "ceiling" }),
    ]);
    // Handwritten maths (RA-65). ClearSpeak reads the logical-not sign as "normal not sign" with an invisible "times" before a
    // bracket, the slanted less-or-equal and greater-or-equal signs as "slanted equals", and the long implication arrow as
    // "long right double arrow" where the short one says "right double arrow".
    const NOT_SIGN = "¬";
    const NOT_WORD = "not";
    const SLANTED_COMPARISONS = Object.freeze({ "⩽": "≤", "⩾": "≥" });
    const LONG_IMPLICATION = "⟹";
    const IMPLICATION = "⇒";
    // A typed note inside a formula (\text{...}): SRE reads the word "Tr" as the function trace, and speaks the full stop of an
    // abbreviation and of the end of the note. "Tr" becomes the two letters; a full stop after a letter that comes before a
    // space, a bracket or the end, and a full stop that ends the note, are dropped. A decimal point and a stop inside an
    // abbreviation ("G.S.") are left alone.
    const TRACE_WORD = /\bTr\b/g;
    const TRACE_SPELLED = "T r";
    const STOP_AFTER_LETTER = /(?<=[A-Za-z])\.(?=[\s )]|$)/g;
    const STOP_ENDING_NOTE = /\.(?=[\s ]*$)/;
    // Only an aligned display (displaystyle) loses the "blank" of an empty first cell; a matrix or a plain array keeps it.
    const ALIGNED_DISPLAY = "displaystyle";
    // Chemistry (RA-68). An export's MathML puts an upright element symbol (H, O, N, Na) next to a script or another symbol with no
    // operator between them, and ClearSpeak reads that as function application: "H sub 2 of O". An invisible times (U+2062) between
    // them says nothing, which is how the tools page already hears it. Only an upright capital-letter symbol qualifies.
    const INVISIBLE_TIMES = "⁢";
    const SCRIPT_ELEMENTS = Object.freeze(["msub", "msup", "msubsup"]);
    const UPRIGHT_VARIANT = "normal";
    const ELEMENT_SYMBOL = /^[A-Z][a-z]?$/;

    function mathElement(name, text) {
        const el = document.createElementNS(MATHML_NS, name);
        if (text) el.textContent = text;
        return el;
    }

    // ClearSpeak says an upright capital Delta "triangle"; the italic capital Delta
    // is spoken "Delta" (measured, SRE in the export's MathJax).
    function nameCapitalDelta(root) {
        root.querySelectorAll("mi").forEach((mi) => {
            if (mi.textContent !== CAPITAL_DELTA) return;
            mi.textContent = ITALIC_CAPITAL_DELTA;
            mi.removeAttribute("mathvariant");
        });
    }

    // A display's equation numbers and tags live in <mlabeledtr> rows, which ClearSpeak
    // ignores, and a one-line display is announced as "1 lines Line 1:". Speak each
    // label as "Equation N:" ahead of its line, and drop the line wrapper around a
    // one-line display. Only a display that is a sole <mtable> is touched, and only
    // an aligned one (displaystyle) or a labelled one, never a matrix. Returns the labels
    // it added, each as the placeholder word it put in and the words to say instead.
    function speakEquationNumbers(root) {
        const added = [];
        const only = root.children.length === 1 ? root.children[0] : null;
        if (!only || only.localName !== "mtable") return added;
        const rows = Array.from(only.children).filter((r) => r.localName === "mtr" || r.localName === "mlabeledtr");
        const labelled = rows.some((r) => r.localName === "mlabeledtr");
        if (!rows.length || !(labelled || only.getAttribute("displaystyle") === "true")) return added;

        // "(1)" -> "Equation 1:", "(P)" -> "Equation P:". Empty label: say nothing. The
        // placeholder is letters only (the n-th one is "equationlabelb" and so on), which
        // SRE reads out as one word and leaves alone.
        const labelOf = (row) => {
            if (row.localName !== "mlabeledtr") return "";
            const text = row.children[0].textContent.trim().replace(/^\((.*)\)$/, "$1").trim();
            if (!text) return "";
            const letters = added.length.toString(26).replace(/[0-9a-p]/g, (d) => String.fromCharCode(97 + parseInt(d, 26)));
            const token = "equationlabel" + letters;
            added.push({ token, spoken: "Equation " + text + ":" });
            return token;
        };
        const cellsOf = (row) => Array.from(row.children).slice(row.localName === "mlabeledtr" ? 1 : 0);

        if (rows.length === 1) {
            const label = labelOf(rows[0]);
            const parts = [];
            if (label) parts.push(mathElement("mtext", label));
            cellsOf(rows[0]).forEach((cell) => parts.push(...Array.from(cell.childNodes)));
            only.replaceWith(...parts);
            return added;
        }
        rows.forEach((row) => {
            if (row.localName !== "mlabeledtr") return;
            const label = labelOf(row);
            const cells = cellsOf(row);
            if (label && cells.length) cells[0].insertBefore(mathElement("mtext", label), cells[0].firstChild);
            const plain = mathElement("mtr");
            cells.forEach((cell) => plain.appendChild(cell));
            row.replaceWith(plain);
        });
        return added;
    }

    // ClearSpeak says nothing for floor or ceiling brackets around a single symbol
    // ("x" for floor x), so the brackets become words. Around anything longer it already
    // says "left floor ... right floor", and the same words are used here.
    function speakFloorsAndCeilings(root) {
        FLOOR_CEILING_BRACKETS.forEach(({ open, close, name }) => {
            Array.from(root.querySelectorAll("mo")).forEach((mo) => {
                if (mo.textContent.trim() !== open || !mo.parentNode) return;
                let depth = 1;
                for (let sib = mo.nextElementSibling; sib; sib = sib.nextElementSibling) {
                    if (sib.localName !== "mo") continue;
                    const text = sib.textContent.trim();
                    if (text === open) depth++;
                    if (text === close) depth--;
                    if (depth) continue;
                    mo.replaceWith(mathElement("mtext", "left " + name));
                    sib.replaceWith(mathElement("mtext", "right " + name));
                    return;
                }
            });
        });
    }

    // MathJax writes \binom{n}{k} as "(" + a fraction with no rule + ")", which ClearSpeak
    // reads as a column matrix. Say "n choose k"; an operand of more than one symbol is
    // bracketed so the listener can tell where it ends.
    function speakBinomials(root) {
        const operand = (el) => {
            if (el.localName !== "mrow" || el.children.length < 2) return el;
            const wrapped = mathElement("mrow");
            wrapped.append(mathElement("mo", "("), el, mathElement("mo", ")"));
            return wrapped;
        };
        Array.from(root.querySelectorAll("mfrac")).forEach((frac) => {
            if (frac.getAttribute("linethickness") !== "0" || frac.children.length !== 2) return;
            const before = frac.previousElementSibling;
            const after = frac.nextElementSibling;
            if (!before || !after || before.textContent.trim() !== "(" || after.textContent.trim() !== ")") return;
            const spoken = mathElement("mrow");
            const [top, bottom] = Array.from(frac.children);
            spoken.append(operand(top), mathElement("mtext", "choose"), operand(bottom));
            before.replaceWith(spoken);
            frac.remove();
            after.remove();
        });
    }

    // A degree sign is a superscript holding only a ring (^\circ, ^{\circ}), which ClearSpeak
    // reads "raised to the composed with power". The superscript becomes the degree sign
    // standing beside its base, and ClearSpeak then says "degree" or "degrees" itself.
    // A ring that is not alone in a superscript (x^{\circ 2}), a subscript, or a bare ring
    // (function composition, f \circ g) is left as it was.
    function speakDegrees(root) {
        Array.from(root.querySelectorAll("msup")).forEach((sup) => {
            if (sup.children.length !== 2) return;
            const [base, script] = Array.from(sup.children);
            const rings = script.localName === "mo" ? [script] : Array.from(script.querySelectorAll("mo"));
            const onlyRing = script.localName === "mo" || (script.localName === "mrow" && script.children.length === 1);
            if (!onlyRing || rings.length !== 1 || !DEGREE_RING_SIGNS.includes(rings[0].textContent.trim())) return;
            sup.replaceWith(base, mathElement("mo", DEGREE_SIGN));
        });
    }

    // Is this MathML element a vector: an arrow or hat over something (\vec, \overrightarrow,
    // \hat), a bold letter (\mathbf, \boldsymbol), or nabla? A subscript, superscript or
    // under/over script of one still is (\vec{s}_{1}), and so is an mrow holding only one.
    function isVectorMarked(el) {
        const base = el.children[0];
        if (el.localName === "mover") {
            const accent = el.children[1];
            if (accent && accent.localName === "mo" && VECTOR_ACCENTS.includes(accent.textContent.trim())) return true;
            return !!base && isVectorMarked(base);
        }
        if (el.localName === "mi" || el.localName === "mo") {
            return VECTOR_BOLD_VARIANTS.includes(el.getAttribute("mathvariant")) || el.textContent.trim() === NABLA;
        }
        if (VECTOR_SCRIPT_ELEMENTS.includes(el.localName)) return !!base && isVectorMarked(base);
        if (el.localName === "mrow") return el.children.length === 1 && isVectorMarked(base);
        return false;
    }

    // ClearSpeak reads a dot operator "times" (\vec{a} \cdot \vec{b}: "a right arrow times b right
    // arrow"). A dot with a vector on EITHER side is a dot product, so the operator becomes the word
    // "dot" and ClearSpeak reads the rest as it did. On the right a leading differential d is skipped
    // (\vec{E} \cdot d \vec{A}). A dot between plain numbers or letters, every cross product (\times)
    // and an ellipsis (\cdots, a different character) are left as they were.
    function speakDotProducts(root) {
        Array.from(root.querySelectorAll("mo"))
            .filter((mo) => DOT_OPERATORS.includes(mo.textContent.trim()))
            .forEach((mo) => {
                const left = mo.previousElementSibling;
                let right = mo.nextElementSibling;
                if (right && right.localName === "mi" && right.textContent.trim() === DIFFERENTIAL_D) right = right.nextElementSibling;
                if (!(left && isVectorMarked(left)) && !(right && isVectorMarked(right))) return;
                mo.replaceWith(mathElement("mtext", DOT_WORD));
            });
    }

    // The logical-not sign is an identifier (or an operator) that SRE reads "normal not sign", with an invisible
    // "times" before a bracket. It becomes the word "not".
    function speakNotSigns(root) {
        Array.from(root.querySelectorAll("mi, mo"))
            .filter((el) => el.textContent.trim() === NOT_SIGN)
            .forEach((el) => el.replaceWith(mathElement("mtext", NOT_WORD)));
    }

    // The slanted less-or-equal and greater-or-equal signs are read "slanted equals"; the plain signs say
    // "is less than or equal to". The operator takes the plain sign.
    function speakSlantedComparisons(root) {
        Array.from(root.querySelectorAll("mo")).forEach((mo) => {
            const plain = SLANTED_COMPARISONS[mo.textContent.trim()];
            if (plain) mo.textContent = plain;
        });
    }

    // SRE reads the word "Tr" in a typed note as the function trace. The word (whole word only: "Track" is left)
    // is spelled as the two letters.
    function speakTraceInNotes(root) {
        Array.from(root.querySelectorAll("mtext")).forEach((note) => {
            const spelled = note.textContent.replace(TRACE_WORD, TRACE_SPELLED);
            if (spelled !== note.textContent) note.textContent = spelled;
        });
    }

    // SRE speaks a full stop in a typed note as the word "period". One after a letter before a space, a bracket or
    // the end ("(Commut.)"), and the one that ends the note ("lines 2,4."), are dropped.
    function speakNoteFullStops(root) {
        Array.from(root.querySelectorAll("mtext")).forEach((note) => {
            const tidied = note.textContent.replace(STOP_AFTER_LETTER, "").replace(STOP_ENDING_NOTE, "");
            if (tidied !== note.textContent) note.textContent = tidied;
        });
    }

    // Each line of an aligned display that starts with "&" has an empty first cell, which SRE reads "blank" at the
    // start of every line. That cell is removed. A matrix and a plain array are not displaystyle, so their empty
    // cells keep "blank", which marks a real empty entry.
    function dropEmptyAlignedCells(root) {
        Array.from(root.querySelectorAll("mtable"))
            .filter((table) => table.getAttribute(ALIGNED_DISPLAY) === "true")
            .forEach((table) => {
                Array.from(table.children).forEach((row) => {
                    if (row.localName !== "mtr" || row.children.length < 2) return;
                    const first = row.children[0];
                    if (first.localName !== "mtd" || first.textContent.trim() || first.children.length) return;
                    first.remove();
                });
            });
    }

    // The long implication arrow is read "long right double arrow" and the short one "right double arrow". The long
    // one takes the short one, so a reader hears one word for both.
    function speakLongImplication(root) {
        Array.from(root.querySelectorAll("mo"))
            .filter((mo) => mo.textContent.trim() === LONG_IMPLICATION)
            .forEach((mo) => { mo.textContent = IMPLICATION; });
    }

    // Is this an upright element symbol: <mi mathvariant="normal"> holding a capital letter and at most one small one,
    // looking through mrows that hold only it?
    function isElementSymbol(el) {
        let e = el;
        while (e.localName === "mrow" && e.children.length === 1) e = e.children[0];
        return e.localName === "mi" && e.getAttribute("mathvariant") === UPRIGHT_VARIANT && ELEMENT_SYMBOL.test(e.textContent.trim());
    }

    // H_2O is read "H sub 2 of O" and the same water written the mhchem way "H of sub 2 O". (This comment must not spell
    // out the mhchem command: the build scans inlined scripts for it and would warn that the document contains chemistry.) Between two neighbours, the left an element symbol (or a script
    // on one) and the right an element symbol or any script, an invisible times is put in, so no "of" is said. An operator
    // beside them is never touched (a times before a "+" would turn it into "positive"), and neither is any identifier that
    // is not an upright capital: P(A), F_1 F_2, \mathrm{d}x and \mathrm{e}^x keep their words.
    function speakChemicalJuxtaposition(root) {
        [root, ...Array.from(root.querySelectorAll("mrow"))].forEach((parent) => {
            Array.from(parent.children).forEach((left) => {
                const right = left.nextElementSibling;
                if (!right || !left.parentNode) return;
                const leftIsSymbol = isElementSymbol(left) || (SCRIPT_ELEMENTS.includes(left.localName) && left.children.length > 0 && isElementSymbol(left.children[0]));
                if (!leftIsSymbol) return;
                if (!isElementSymbol(right) && !SCRIPT_ELEMENTS.includes(right.localName)) return;
                left.after(mathElement("mo", INVISIBLE_TIMES));
            });
        });
    }

    // The MathML handed to the Speech Rule Engine. MathSpeak is passed through as
    // MathJax wrote it. ClearSpeak first has twelve things put right on a COPY (the
    // page's own MathML is never touched), because its defaults lose content a
    // listener needs: a visible equation number or tag, the name "delta" (it says
    // "triangle"), floor and ceiling brackets around a single symbol, a
    // binomial (it says "the 2 by 1 column matrix n k"), a degree sign (it says
    // "raised to the composed with power"), a dot between vectors (it says
    // "times", where MathSpeak says "dot"), and five faults of handwritten maths: the
    // logical-not sign ("normal not sign", and a "times" before a bracket), the slanted
    // less-or-equal and greater-or-equal signs ("slanted equals"), a typed note's "Tr"
    // ("trace") and its full stops, the empty first cell of an aligned line ("blank"),
    // and the long implication arrow ("long right double arrow"), and a chemical formula's stray "of" (H_2O is "H sub 2 of
    // O"). If anything goes wrong the
    // original MathML is used, so speech is never lost to this. Returns the MathML
    // and the equation labels that were added to it (see restoreLabels).
    function forSpeech(math, domain) {
        if (domain !== "clearspeak") return { mathml: math.outerHTML, labels: [] };
        try {
            const copy = math.cloneNode(true);
            nameCapitalDelta(copy);
            const labels = speakEquationNumbers(copy);
            speakFloorsAndCeilings(copy);
            speakBinomials(copy);
            speakDegrees(copy);
            speakDotProducts(copy);
            speakNotSigns(copy);
            speakSlantedComparisons(copy);
            speakTraceInNotes(copy);
            speakNoteFullStops(copy);
            dropEmptyAlignedCells(copy);
            speakLongImplication(copy);
            speakChemicalJuxtaposition(copy);
            return { mathml: copy.outerHTML, labels };
        } catch (e) {
            return { mathml: math.outerHTML, labels: [] };
        }
    }

    // SRE would read a label's own text its own way ("Equation cap P", and a ":" as the
    // word "colon"), so a label goes into the MathML as a plain placeholder word and the
    // real "Equation P:" replaces that word in the speech afterwards.
    function restoreLabels(speech, labels) {
        labels.forEach(({ token, spoken }) => {
            speech = speech.replace(token, () => spoken);
        });
        return speech;
    }

    return Object.freeze({ forSpeech, restoreLabels });
})();
