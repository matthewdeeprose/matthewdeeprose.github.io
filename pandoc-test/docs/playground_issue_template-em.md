# Issue Report: [BRIEF DESCRIPTION]

## Problem Summary

[Describe the issue concisely - what's not working as expected?]

## LaTeX Rendering Pipeline Overview

### How LaTeX is Processed in the Playground

1. **Input Stage** (`index.html`)

   - User enters LaTeX in `#input` textarea
   - Debounced input handler triggers conversion after 300ms

2. **Preprocessing Stage** (`conversion-engine.js`)

   - Document-level commands removed (e.g., `\index{}`, `\qedhere`)
   - Complexity assessment determines processing strategy
   - LaTeX expressions extracted and mapped for annotation preservation

3. **Pandoc Conversion** (`pandoc.wasm`)

   - LaTeX → HTML conversion via WebAssembly
   - Arguments: `--from latex --to html5 --mathml`
   - Enhanced arguments available via investigation mode

4. **Post-processing** (`conversion-engine.js`)

   - HTML cleaning and duplicate removal
   - Title block deduplication for chunked processing

5. **MathJax Rendering** (`mathjax-manager.js`)

   - Mathematical expressions rendered in browser
   - Accessibility features enabled (screen reader support)
   - Original LaTeX preserved for annotations

6. **Export Generation** (`export-manager.js`, `template-system.js`)
   - Self-contained HTML files with embedded dependencies
   - Accessibility compliance (WCAG 2.2 AA)
   - Font embedding and theme support

### Key Files and Responsibilities

#### Core Application Files

- **`index.html`** - Main playground interface, DOM elements, global setup
- **`js/pandoc/conversion-engine.js`** - LaTeX processing, Pandoc integration, error handling
- **`js/export/mathjax-manager.js`** - MathJax configuration and rendering
- **`js/export/export-manager.js`** - Export orchestration and file generation
- **`js/export/template-system.js`** - HTML template generation (2,500+ lines)

#### Supporting Modules

- **`js/pandoc/status-manager.js`** - UI status updates and progress indication
- **`js/pandoc/example-system.js`** - LaTeX example management
- **`js/export/latex-processor.js`** - Advanced LaTeX preprocessing
- **`js/export/content-generator.js`** - CSS and content generation

#### Testing Framework

- **`js/testing/test-utilities.js`** - Core testing infrastructure
- **`js/testing/individual/test-*.js`** - Individual module tests
- **`js/testing/integration/test-*.js`** - Integration tests

### Critical Testing Commands

Before any development work:

```javascript
const baseline = testAllSafe();
if (!baseline.overallSuccess) {
  throw new Error("Cannot begin development with failing tests");
}
```

Essential validation commands:

```javascript
testAllSafe(); // Silent comprehensive testing
systemStatus(); // Quick health check
testRenderingAccuracy(); // Check for MathJax rendering errors
testAccessibilityIntegration(); // WCAG 2.2 AA compliance
testConversionEngine(); // Core conversion validation
```

### LaTeX Processing Flow

```
User Input → Preprocessing → Pandoc WASM → Post-processing → MathJax → Display
     ↓             ↓              ↓              ↓           ↓         ↓
  Raw LaTeX   Clean LaTeX    HTML + MathML   Clean HTML   Rendered   Output
```

### Common Integration Points

1. **DOM Elements** (`window.appElements`)

   - `inputTextarea` - LaTeX input
   - `outputDiv` - Rendered output
   - `argumentsInput` - Pandoc arguments

2. **Global Registries**

   - `window.originalLatexRegistry` - LaTeX expression mapping
   - `window.originalLatexByPosition` - Ordered LaTeX expressions

3. **Status Management**
   - `window.StatusManager.setLoading(message, progress)`
   - `window.StatusManager.setReady(message)`
   - `window.StatusManager.setError(message)`

## Issue Details

### Expected Behaviour

With this latex:

```
\begin{definition}
A \emph{function} $f$ \index{function} from a set $A$ to a set $B$ is
 a rule that assigns to \underline{each} element of the set $A$ a \underline{unique} element of the set $B$.

We use the notation: $f:A\to B$.
The set $A$  is called the \emph{domain} \index{domain} and the set $B$ the \emph{codomain} \index{codomain} of the function.
The \emph{range} \index{range} of $f$ is the set
$$f[A]=\{y\in B : \text{there is an } x\in A \text{ such that } f(x)=y\}.$$
\end{definition}
```

we should expect to see words

- function
- each
- unique
- domain
- codomain
- range to have empplhasesis

### Actual Behaviour

<div class="definition">
<p><strong>Definition 1</strong>. <em>A <em>function</em> <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="f" sre-explorer-id="8557" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8557" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="f"><mjx-c class="mjx-c1D453 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="f">f</mi><annotation encoding="application/x-tex">f</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> from a set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper A" sre-explorer-id="8558" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8558" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper A"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper A">A</mi><annotation encoding="application/x-tex">A</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> to a set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper B" sre-explorer-id="8559" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8559" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper B"><mjx-c class="mjx-c1D435 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper B">B</mi><annotation encoding="application/x-tex">B</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> is
a rule that assigns to <u>each</u> element of the set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper A" sre-explorer-id="8560" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8560" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper A"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper A">A</mi><annotation encoding="application/x-tex">A</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> a <u>unique</u> element of the set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper B" sre-explorer-id="8561" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8561" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper B"><mjx-c class="mjx-c1D435 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper B">B</mi><annotation encoding="application/x-tex">B</annotation></semantics></math></mjx-assistive-mml></mjx-container></span>.</em></p>
<p><em>We use the notation: <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="f colon upper A right arrow upper B" sre-explorer-id="8562" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8562" style="font-size: 113.1%; position: relative;"><mjx-math data-semantic-type="punctuated" data-semantic-role="sequence" data-semantic-id="6" data-semantic-children="0,1,5" data-semantic-content="1" data-semantic-speech="f colon upper A right arrow upper B" class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-parent="6"><mjx-c class="mjx-c1D453 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" space="4" data-semantic-type="punctuation" data-semantic-role="colon" data-semantic-id="1" data-semantic-parent="6" data-semantic-operator="punctuated"><mjx-c class="mjx-c3A"></mjx-c></mjx-mo><mjx-mrow space="4" data-semantic-type="relseq" data-semantic-role="arrow" data-semantic-id="5" data-semantic-children="2,4" data-semantic-content="3" data-semantic-parent="6"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="2" data-semantic-parent="5"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" space="4" data-semantic-type="relation" data-semantic-role="arrow" data-semantic-id="3" data-semantic-parent="5" data-semantic-operator="relseq,→"><mjx-c class="mjx-c2192"></mjx-c></mjx-mo><mjx-mi class="mjx-i" space="4" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="4" data-semantic-parent="5"><mjx-c class="mjx-c1D435 TEX-I"></mjx-c></mjx-mi></mjx-mrow></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML" data-semantic-type="punctuated" data-semantic-role="sequence" data-semantic-="" data-semantic-children="0,1,5" data-semantic-content="1" data-semantic-speech="f colon upper A right arrow upper B"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="6">f</mi><mo data-semantic-type="punctuation" data-semantic-role="colon" data-semantic-="" data-semantic-parent="6" data-semantic-operator="punctuated">:</mo><mrow data-semantic-type="relseq" data-semantic-role="arrow" data-semantic-="" data-semantic-children="2,4" data-semantic-content="3" data-semantic-parent="6"><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="5">A</mi><mo accent="false" stretchy="false" data-semantic-type="relation" data-semantic-role="arrow" data-semantic-="" data-semantic-parent="5" data-semantic-operator="relseq,→">→</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="5">B</mi></mrow><annotation encoding="application/x-tex">f:A\to B</annotation></semantics></math></mjx-assistive-mml></mjx-container></span>.
The set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper A" sre-explorer-id="8563" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8563" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper A"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper A">A</mi><annotation encoding="application/x-tex">A</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> is called the <em>domain</em> and the set <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="upper B" sre-explorer-id="8564" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8564" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="upper B"><mjx-c class="mjx-c1D435 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="upper B">B</mi><annotation encoding="application/x-tex">B</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> the <em>codomain</em> of the function.
The <em>range</em> of <span class="math inline"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" aria-label="f" sre-explorer-id="8565" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8565" style="font-size: 113.1%; position: relative;"><mjx-math class="MJX-TEX" aria-hidden="true"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-speech="f"><mjx-c class="mjx-c1D453 TEX-I"></mjx-c></mjx-mi></mjx-math><mjx-assistive-mml unselectable="on" display="inline" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML"><semantics><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-speech="f">f</mi><annotation encoding="application/x-tex">f</annotation></semantics></math></mjx-assistive-mml></mjx-container></span> is the set
<span class="math display"><mjx-container class="MathJax CtxtMenu_Attached_0" jax="CHTML" display="true" aria-label="f left bracket upper A right bracket equals StartSet y element of upper B colon there is an x element of upper A such that f left parenthesis x right parenthesis equals y EndSet period" sre-explorer-id="8566" tabindex="0" role="application" ctxtmenu_oldtabindex="1" ctxtmenu_counter="8566" style="font-size: 113.1%; position: relative;"><mjx-math data-semantic-type="punctuated" data-semantic-role="endpunct" data-semantic-id="39" data-semantic-children="38,22" data-semantic-content="22" data-semantic-speech="f left bracket upper A right bracket equals StartSet y element of upper B colon there is an x element of upper A such that f left parenthesis x right parenthesis equals y EndSet period" display="true" class="MJX-TEX" aria-hidden="true" style="margin-left: 0px; margin-right: 0px;"><mjx-mrow data-semantic-type="relseq" data-semantic-role="equality" data-semantic-id="38" data-semantic-children="37,35" data-semantic-content="4" data-semantic-parent="39"><mjx-mrow data-semantic-type="appl" data-semantic-role="simple function" data-semantic-annotation="clearspeak:simple" data-semantic-id="37" data-semantic-children="0,23" data-semantic-content="36,0" data-semantic-parent="38"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="simple function" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="0" data-semantic-parent="37" data-semantic-operator="appl"><mjx-c class="mjx-c1D453 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" data-semantic-type="punctuation" data-semantic-role="application" data-semantic-id="36" data-semantic-parent="37" data-semantic-added="true" data-semantic-operator="appl"><mjx-c class="mjx-c2061"></mjx-c></mjx-mo><mjx-mrow data-semantic-type="fenced" data-semantic-role="leftright" data-semantic-id="23" data-semantic-children="2" data-semantic-content="1,3" data-semantic-parent="37"><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="open" data-semantic-id="1" data-semantic-parent="23" data-semantic-operator="fenced"><mjx-c class="mjx-c5B"></mjx-c></mjx-mo><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="2" data-semantic-parent="23"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="close" data-semantic-id="3" data-semantic-parent="23" data-semantic-operator="fenced"><mjx-c class="mjx-c5D"></mjx-c></mjx-mo></mjx-mrow></mjx-mrow><mjx-mo class="mjx-n" space="4" data-semantic-type="relation" data-semantic-role="equality" data-semantic-id="4" data-semantic-parent="38" data-semantic-operator="relseq,="><mjx-c class="mjx-c3D"></mjx-c></mjx-mo><mjx-mrow space="4" data-semantic-type="fenced" data-semantic-role="set extended" data-semantic-id="35" data-semantic-children="34" data-semantic-content="5,21" data-semantic-parent="38"><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="open" data-semantic-id="5" data-semantic-parent="35" data-semantic-operator="fenced"><mjx-c class="mjx-c7B"></mjx-c></mjx-mo><mjx-mrow data-semantic-type="punctuated" data-semantic-role="sequence" data-semantic-id="34" data-semantic-children="25,9,33" data-semantic-content="9" data-semantic-parent="35"><mjx-mrow data-semantic-type="infixop" data-semantic-role="element" data-semantic-annotation="set:intensional" data-semantic-id="25" data-semantic-children="6,8" data-semantic-content="7" data-semantic-parent="34"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="6" data-semantic-parent="25"><mjx-c class="mjx-c1D466 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" space="4" data-semantic-type="operator" data-semantic-role="element" data-semantic-annotation="set:intensional" data-semantic-id="7" data-semantic-parent="25" data-semantic-operator="infixop,∈"><mjx-c class="mjx-c2208"></mjx-c></mjx-mo><mjx-mi class="mjx-i" space="4" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="8" data-semantic-parent="25"><mjx-c class="mjx-c1D435 TEX-I"></mjx-c></mjx-mi></mjx-mrow><mjx-mo class="mjx-n" space="4" data-semantic-type="punctuation" data-semantic-role="colon" data-semantic-id="9" data-semantic-parent="34" data-semantic-operator="punctuated"><mjx-c class="mjx-c3A"></mjx-c></mjx-mo><mjx-mrow space="4" data-semantic-type="punctuated" data-semantic-role="text" data-semantic-id="33" data-semantic-children="10,26,14,29" data-semantic-parent="34" data-semantic-collapsed="(33 (c 30 31 32) 10 26 14 29)"><mjx-mtext class="mjx-n" data-semantic-type="text" data-semantic-role="unknown" data-semantic-font="normal" data-semantic-annotation="clearspeak:unit" data-semantic-id="10" data-semantic-parent="33"><mjx-c class="mjx-c74"></mjx-c><mjx-c class="mjx-c68"></mjx-c><mjx-c class="mjx-c65"></mjx-c><mjx-c class="mjx-c72"></mjx-c><mjx-c class="mjx-c65"></mjx-c><mjx-c class="mjx-c20"></mjx-c><mjx-c class="mjx-c69"></mjx-c><mjx-c class="mjx-c73"></mjx-c><mjx-c class="mjx-c20"></mjx-c><mjx-c class="mjx-c61"></mjx-c><mjx-c class="mjx-c6E"></mjx-c><mjx-c class="mjx-cA0"></mjx-c></mjx-mtext><mjx-mrow data-semantic-type="infixop" data-semantic-role="element" data-semantic-id="26" data-semantic-children="11,13" data-semantic-content="12" data-semantic-parent="33"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="11" data-semantic-parent="26"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" space="4" data-semantic-type="operator" data-semantic-role="element" data-semantic-id="12" data-semantic-parent="26" data-semantic-operator="infixop,∈"><mjx-c class="mjx-c2208"></mjx-c></mjx-mo><mjx-mi class="mjx-i" space="4" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="13" data-semantic-parent="26"><mjx-c class="mjx-c1D434 TEX-I"></mjx-c></mjx-mi></mjx-mrow><mjx-mtext class="mjx-n" data-semantic-type="text" data-semantic-role="unknown" data-semantic-font="normal" data-semantic-annotation="clearspeak:unit" data-semantic-id="14" data-semantic-parent="33"><mjx-c class="mjx-cA0"></mjx-c><mjx-c class="mjx-c73"></mjx-c><mjx-c class="mjx-c75"></mjx-c><mjx-c class="mjx-c63"></mjx-c><mjx-c class="mjx-c68"></mjx-c><mjx-c class="mjx-c20"></mjx-c><mjx-c class="mjx-c74"></mjx-c><mjx-c class="mjx-c68"></mjx-c><mjx-c class="mjx-c61"></mjx-c><mjx-c class="mjx-c74"></mjx-c><mjx-c class="mjx-cA0"></mjx-c></mjx-mtext><mjx-mrow data-semantic-type="relseq" data-semantic-role="equality" data-semantic-id="29" data-semantic-children="28,20" data-semantic-content="19" data-semantic-parent="33"><mjx-mrow data-semantic-type="appl" data-semantic-role="simple function" data-semantic-annotation="clearspeak:simple" data-semantic-id="28" data-semantic-children="15,24" data-semantic-content="27,15" data-semantic-parent="29"><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="simple function" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="15" data-semantic-parent="28" data-semantic-operator="appl"><mjx-c class="mjx-c1D453 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" data-semantic-type="punctuation" data-semantic-role="application" data-semantic-id="27" data-semantic-parent="28" data-semantic-added="true" data-semantic-operator="appl"><mjx-c class="mjx-c2061"></mjx-c></mjx-mo><mjx-mrow data-semantic-type="fenced" data-semantic-role="leftright" data-semantic-id="24" data-semantic-children="17" data-semantic-content="16,18" data-semantic-parent="28"><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="open" data-semantic-id="16" data-semantic-parent="24" data-semantic-operator="fenced"><mjx-c class="mjx-c28"></mjx-c></mjx-mo><mjx-mi class="mjx-i" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="17" data-semantic-parent="24"><mjx-c class="mjx-c1D465 TEX-I"></mjx-c></mjx-mi><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="close" data-semantic-id="18" data-semantic-parent="24" data-semantic-operator="fenced"><mjx-c class="mjx-c29"></mjx-c></mjx-mo></mjx-mrow></mjx-mrow><mjx-mo class="mjx-n" space="4" data-semantic-type="relation" data-semantic-role="equality" data-semantic-id="19" data-semantic-parent="29" data-semantic-operator="relseq,="><mjx-c class="mjx-c3D"></mjx-c></mjx-mo><mjx-mi class="mjx-i" space="4" data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-id="20" data-semantic-parent="29"><mjx-c class="mjx-c1D466 TEX-I"></mjx-c></mjx-mi></mjx-mrow></mjx-mrow></mjx-mrow><mjx-mo class="mjx-n" data-semantic-type="fence" data-semantic-role="close" data-semantic-id="21" data-semantic-parent="35" data-semantic-operator="fenced"><mjx-c class="mjx-c7D"></mjx-c></mjx-mo></mjx-mrow></mjx-mrow><mjx-mo class="mjx-n" data-semantic-type="punctuation" data-semantic-role="fullstop" data-semantic-id="22" data-semantic-parent="39" data-semantic-operator="punctuated"><mjx-c class="mjx-c2E"></mjx-c></mjx-mo></mjx-math><mjx-assistive-mml unselectable="on" display="block" aria-hidden="true"><math xmlns="http://www.w3.org/1998/Math/MathML" display="block" data-semantic-type="punctuated" data-semantic-role="endpunct" data-semantic-="" data-semantic-children="38,22" data-semantic-content="22" data-semantic-speech="f left bracket upper A right bracket equals StartSet y element of upper B colon there is an x element of upper A such that f left parenthesis x right parenthesis equals y EndSet period"><semantics><mrow data-semantic-type="relseq" data-semantic-role="equality" data-semantic-="" data-semantic-children="37,35" data-semantic-content="4" data-semantic-parent="39"><mrow data-semantic-type="appl" data-semantic-role="simple function" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-children="0,23" data-semantic-content="36,0" data-semantic-parent="38"><mi data-semantic-type="identifier" data-semantic-role="simple function" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="37" data-semantic-operator="appl">f</mi><mo data-semantic-type="punctuation" data-semantic-role="application" data-semantic-="" data-semantic-parent="37" data-semantic-added="true" data-semantic-operator="appl">⁡</mo><mrow data-semantic-type="fenced" data-semantic-role="leftright" data-semantic-="" data-semantic-children="2" data-semantic-content="1,3" data-semantic-parent="37"><mo stretchy="false" data-semantic-type="fence" data-semantic-role="open" data-semantic-="" data-semantic-parent="23" data-semantic-operator="fenced">[</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="23">A</mi><mo stretchy="false" data-semantic-type="fence" data-semantic-role="close" data-semantic-="" data-semantic-parent="23" data-semantic-operator="fenced">]</mo></mrow></mrow><mo data-semantic-type="relation" data-semantic-role="equality" data-semantic-="" data-semantic-parent="38" data-semantic-operator="relseq,=">=</mo><mrow data-semantic-type="fenced" data-semantic-role="set extended" data-semantic-="" data-semantic-children="34" data-semantic-content="5,21" data-semantic-parent="38"><mo fence="false" stretchy="false" data-semantic-type="fence" data-semantic-role="open" data-semantic-="" data-semantic-parent="35" data-semantic-operator="fenced">{</mo><mrow data-semantic-type="punctuated" data-semantic-role="sequence" data-semantic-="" data-semantic-children="25,9,33" data-semantic-content="9" data-semantic-parent="35"><mrow data-semantic-type="infixop" data-semantic-role="element" data-semantic-annotation="set:intensional" data-semantic-="" data-semantic-children="6,8" data-semantic-content="7" data-semantic-parent="34"><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="25">y</mi><mo data-semantic-type="operator" data-semantic-role="element" data-semantic-annotation="set:intensional" data-semantic-="" data-semantic-parent="25" data-semantic-operator="infixop,∈">∈</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="25">B</mi></mrow><mo data-semantic-type="punctuation" data-semantic-role="colon" data-semantic-="" data-semantic-parent="34" data-semantic-operator="punctuated">:</mo><mrow data-semantic-type="punctuated" data-semantic-role="text" data-semantic-="" data-semantic-children="10,26,14,29" data-semantic-parent="34" data-semantic-collapsed="(33 (c 30 31 32) 10 26 14 29)"><mtext data-semantic-type="text" data-semantic-role="unknown" data-semantic-font="normal" data-semantic-annotation="clearspeak:unit" data-semantic-="" data-semantic-parent="33">there is an&nbsp;</mtext><mrow data-semantic-type="infixop" data-semantic-role="element" data-semantic-="" data-semantic-children="11,13" data-semantic-content="12" data-semantic-parent="33"><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="26">x</mi><mo data-semantic-type="operator" data-semantic-role="element" data-semantic-="" data-semantic-parent="26" data-semantic-operator="infixop,∈">∈</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="26">A</mi></mrow><mtext data-semantic-type="text" data-semantic-role="unknown" data-semantic-font="normal" data-semantic-annotation="clearspeak:unit" data-semantic-="" data-semantic-parent="33">&nbsp;such that&nbsp;</mtext><mrow data-semantic-type="relseq" data-semantic-role="equality" data-semantic-="" data-semantic-children="28,20" data-semantic-content="19" data-semantic-parent="33"><mrow data-semantic-type="appl" data-semantic-role="simple function" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-children="15,24" data-semantic-content="27,15" data-semantic-parent="29"><mi data-semantic-type="identifier" data-semantic-role="simple function" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="28" data-semantic-operator="appl">f</mi><mo data-semantic-type="punctuation" data-semantic-role="application" data-semantic-="" data-semantic-parent="28" data-semantic-added="true" data-semantic-operator="appl">⁡</mo><mrow data-semantic-type="fenced" data-semantic-role="leftright" data-semantic-="" data-semantic-children="17" data-semantic-content="16,18" data-semantic-parent="28"><mo stretchy="false" data-semantic-type="fence" data-semantic-role="open" data-semantic-="" data-semantic-parent="24" data-semantic-operator="fenced">(</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="24">x</mi><mo stretchy="false" data-semantic-type="fence" data-semantic-role="close" data-semantic-="" data-semantic-parent="24" data-semantic-operator="fenced">)</mo></mrow></mrow><mo data-semantic-type="relation" data-semantic-role="equality" data-semantic-="" data-semantic-parent="29" data-semantic-operator="relseq,=">=</mo><mi data-semantic-type="identifier" data-semantic-role="latinletter" data-semantic-font="italic" data-semantic-annotation="clearspeak:simple" data-semantic-="" data-semantic-parent="29">y</mi></mrow></mrow></mrow><mo fence="false" stretchy="false" data-semantic-type="fence" data-semantic-role="close" data-semantic-="" data-semantic-parent="35" data-semantic-operator="fenced">}</mo></mrow></mrow><mo data-semantic-type="punctuation" data-semantic-role="fullstop" data-semantic-="" data-semantic-parent="39" data-semantic-operator="punctuated">.</mo><annotation encoding="application/x-tex">f[A]=\{y\in B : \text{there is an } x\in A \text{ such that } f(x)=y\}.</annotation></semantics></math></mjx-assistive-mml></mjx-container></span></em></p>
</div>

### Steps to Reproduce

1.
2.
3.

### LaTeX Example (if applicable)

```latex
[Minimal LaTeX that demonstrates the issue]
```

### Browser Console Output

```
[Any error messages or relevant console output]
```

### Testing Results

[Run relevant test commands and paste results]

```javascript
// Example:
testRenderingAccuracy();
// Result: X failed commands detected...
```

## Technical Context

### Files Likely Involved

- [ ] `conversion-engine.js` (LaTeX processing)
- [ ] `mathjax-manager.js` (Mathematical rendering)
- [ ] `export-manager.js` (Export generation)
- [ ] `template-system.js` (HTML generation)
- [ ] `index.html` (UI and DOM)
- [ ] Other: ****\_\_\_\_****

### Processing Stage Where Issue Occurs

- [ ] Input preprocessing
- [ ] Pandoc conversion
- [ ] Post-processing
- [ ] MathJax rendering
- [ ] Export generation
- [ ] UI interaction

### Browser and Environment

- Browser: ******\_\_\_******
- Version: ******\_\_\_******
- Operating System: **\_\_\_**

### Accessibility Impact

- [ ] Screen reader compatibility affected
- [ ] Keyboard navigation impacted
- [ ] WCAG 2.2 AA compliance concerns
- [ ] No accessibility impact

## Proposed Solution (if any)

[Any ideas for fixing the issue]

## Additional Notes

[Any other relevant information]

---

## Development Protocol Reminder

**Single-File Development Protocol:**

1. Pre-test: Run relevant test functions (baseline)
2. Modify: Change ONE file only
3. Immediate test: Validate changes
4. Integration test: Run `testAllSafe()`
5. Only proceed when current file proven working

**File Modification Format:**

````
Step X of Y

FIND THIS ENTIRE BLOCK (approximately lines XXX-YYY):
```[code block]```

REPLACE WITH THIS NEW BLOCK:
```[code block]```
````

**Testing Hierarchy:**

1. Isolated file tests
2. Integration tests
3. Cross-file tests
4. Real-world validation
5. Performance verification
