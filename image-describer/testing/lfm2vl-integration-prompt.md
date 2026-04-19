# LFM2-VL-450M Integration — Implementation Prompt

## Goal

Add `onnx-community/LFM2-VL-450M-ONNX` as a third local VLM option in the Image Describer tool, alongside FastVLM 0.5B and Qwen3.5-0.8B. The user should be able to select it from the local model dropdown, download/cache it, and generate image descriptions — all through the existing GUI.

---

## Context — Read These Files First

1. **`CLAUDE.md`** — Project conventions (IIFE, British English, logging, WCAG 2.2 AA, no NPM, incremental one-file-at-a-time workflow, 500-line file limit noted but these files already exceed it).
2. **`image-describer/analyser/image-describer-analyser-transformers.js`** — THE critical file. Study these patterns in detail before writing any code:
   - Model constants: `FASTVLM_MODEL_ID` (line ~89), `QWEN35_MODEL_ID` / `QWEN35_CLASS_NAME` (lines ~92–93)
   - Closure state variables: `fastvlmModel`, `fastvlmProcessor`, `fastvlmStatus` (and Qwen equivalents)
   - `ensureFastVLM(options)` (lines ~1003–1103) — loading pattern to clone
   - `generateLocalDescription(imageSource, options)` (lines ~1129–1228) — inference pattern to clone
   - `getFastVLMStatus()` (line ~1110) — status getter pattern
   - `destroy()` function — disposal pattern for each model
   - The public API return object at the bottom of the IIFE — where new functions must be exported
   - `emitStatus()` pattern for UI updates
   - ResilientFetch progress bridge pattern
3. **`image-describer/image-describer-model-manager.js`** — Model registry and lifecycle. Study:
   - The model registry entries (search for `fastvlm` and `qwen35` entries)
   - `getModelState()` — how it checks gateway status per model key
   - `preDownloadModel()` — how it triggers downloads per model key
   - `loadModel()` — how it loads models per model key
4. **`image-describer/image-describer-controller-generate.js`** — Generation flow. Study:
   - `LOCAL_PROGRESS_STAGES` and `QWEN_PROGRESS_STAGES` constants
   - `showProgress()` — how it looks up stage configs
   - `generateLocally()` — how it routes to FastVLM vs Qwen based on `localModel` value
   - `generateLocallyQwen()` — the Qwen-specific generation method (for structural reference)
   - `buildQwenPrompt()` — Qwen prompt builder (LFM2-VL will use a simpler free-form prompt like FastVLM)
   - `_renderPlainTextAsHtml()` — used for FastVLM output display (LFM2-VL will use this too)
5. **`image-describer/image-describer-controller-model.js`** — Model status display. Study:
   - `_updateLocalModelInfo()` — how it checks FastVLM/Qwen states and updates the "any local ready" flag
6. **`tools.html`** — Search for `localModelSelect` to find the local model dropdown. Study the existing `<option>` elements for FastVLM and Qwen3.5, and the hint text below the dropdown.

---

## What We Know From Spike Testing

All confirmed via `spike-lfm2vl-harness.js` and follow-up inference style comparison:

| Fact | Value |
|------|-------|
| Model ID | `onnx-community/LFM2-VL-450M-ONNX` |
| Working class | `AutoModelForImageTextToText` (same as FastVLM) |
| Architecture | `Lfm2VlForConditionalGeneration` (model_type: `lfm2_vl`) |
| dtype config | `{ dtype: 'q4', device: 'webgpu' }` (flat — NOT per-component like FastVLM) |
| Processor | `AutoProcessor.from_pretrained()` works |
| Download size | ~349 MB (248 MB decoder + 60 MB vision encoder + 41 MB embed tokens) |
| Inference time | ~6.5s (first run), ~1.9s (warm, from cache) |
| Message format | **FastVLM-style ONLY** — single string: `"<image>" + promptText` |
| Processor call | **Image first:** `processor(image, prompt, { add_special_tokens: false })` |
| Decode method | `processor.batch_decode()` (NOT `processor.tokenizer.batch_decode()`) |
| Chat template | `processor.apply_chat_template(messages, { add_generation_prompt: true })` |

**Styles that DO NOT work (confirmed — do not attempt):**
- Qwen-style conversation array with `{ type: 'image' }` → throws "undefined is not iterable"
- Minimal (no chat template) → throws "Number of tokens and features do not match"

**Output characteristics:**
- Free-form prose (like FastVLM, not structured sections like Qwen)
- Detects colours and basic shapes
- May hallucinate text content — known limitation

---

## Implementation — 5 Files, One at a Time

### File 1 of 5: `image-describer/analyser/image-describer-analyser-transformers.js`

**Add these elements, following the exact FastVLM pattern:**

1. **Constant** (after `QWEN35_CLASS_NAME` at line ~93):
   ```javascript
   const LFM2VL_MODEL_ID = 'onnx-community/LFM2-VL-450M-ONNX';
   ```

2. **Closure state** (after the existing Qwen state variables — search for `let qwen35Status`):
   ```javascript
   let lfm2vlModel = null;
   let lfm2vlProcessor = null;
   let lfm2vlStatus = 'not-loaded';
   ```

3. **`ensureLfm2Vl(options)`** — Clone `ensureFastVLM()` with these differences:
   - References `lfm2vlModel`, `lfm2vlProcessor`, `lfm2vlStatus`
   - Model ID: `LFM2VL_MODEL_ID`
   - Status emit key: `'lfm2vl'`
   - dtype: `{ dtype: 'q4', device: 'webgpu' }` (flat object, NOT per-component)
   - Uses `AutoModelForImageTextToText` (same as FastVLM)
   - ResilientFetch bridge checks for `'LFM2-VL'` in event URL
   - Log prefix: `'LFM2-VL'` (not `'FastVLM'`)

4. **`getLfm2VlStatus()`** — Returns `lfm2vlStatus`.

5. **`generateLfm2VlDescription(imageSource, options)`** — Clone `generateLocalDescription()` with these differences:
   - Calls `ensureLfm2Vl()` instead of `ensureFastVLM()`
   - Default prompt: `'Describe this image in detail for accessibility purposes.'`
   - Returns `model: LFM2VL_MODEL_ID` in the result object
   - Log prefix: `'LFM2-VL'`
   - Everything else identical: `<image>` token format, image-first processor call, `processor.batch_decode()`, TextStreamer pattern

6. **Disposal in `destroy()`** — Add a block for LFM2-VL (clone the FastVLM disposal block, reference `lfm2vlModel` and `lfm2vlProcessor`).

7. **Public API** — Add to the return object at the bottom:
   ```javascript
   ensureLfm2Vl: ensureLfm2Vl,
   getLfm2VlStatus: getLfm2VlStatus,
   generateLfm2VlDescription: generateLfm2VlDescription,
   LFM2VL_MODEL_ID: LFM2VL_MODEL_ID,
   ```

**Console test after this file:**
```javascript
(() => {
  const gw = window.ImageDescriberAnalyserTransformers;
  const results = {
    'ensureLfm2Vl exists': typeof gw.ensureLfm2Vl === 'function',
    'getLfm2VlStatus exists': typeof gw.getLfm2VlStatus === 'function',
    'generateLfm2VlDescription exists': typeof gw.generateLfm2VlDescription === 'function',
    'LFM2VL_MODEL_ID': gw.LFM2VL_MODEL_ID,
    'initial status': gw.getLfm2VlStatus(),
  };
  console.table(results);
})();
```

Then test loading:
```javascript
await ImageDescriberAnalyserTransformers.ensureLfm2Vl();
ImageDescriberAnalyserTransformers.getLfm2VlStatus(); // should be 'ready'
```

---

### File 2 of 5: `image-describer/image-describer-model-manager.js`

**Add these elements, following the existing FastVLM/Qwen pattern:**

1. **Model registry entry** (after the `qwen35` entry in the registry array):
   ```javascript
   {
     key: 'lfm2vl',
     name: 'LFM2-VL 450M',
     modelId: 'onnx-community/LFM2-VL-450M-ONNX',
     role: 'Local description generation — compact VLM, no API key needed',
     sizeMB: 349,
     task: null,
     enabled: true,
     status: 'active',
     cachePrefix: 'https://huggingface.co/onnx-community/LFM2-VL-450M-ONNX/',
     components: ['AutoModelForImageTextToText', 'AutoProcessor']
   },
   ```

2. **`getModelState()` branch** (after the Qwen block): Add `if (modelKey === 'lfm2vl')` that calls `gateway.getLfm2VlStatus()`.

3. **`preDownloadModel()` branch** (after the Qwen branch): Add `else if (modelKey === 'lfm2vl')` that calls `gateway.ensureLfm2Vl({ progressCallback: onProgress || null })`.

4. **`loadModel()` branch** (after the Qwen branch): Add `else if (modelKey === 'lfm2vl')` that calls `gateway.ensureLfm2Vl()`.

**Console test:** Open the model manager panel in the GUI and verify LFM2-VL 450M appears in the model list with correct size and status.

---

### File 3 of 5: `tools.html`

1. **Local model dropdown option** (after the Qwen3.5 `<option>` inside the `localModelSelect` `<select>`):
   ```html
   <option value="lfm2vl">
     LFM2-VL 450M — Compact, fast (~7s)
   </option>
   ```

2. **Hint text update** — Update the description below the dropdown to mention all three models. Keep it concise — something like:
   > FastVLM and LFM2-VL produce free-form prose descriptions. Qwen3.5 produces structured sections (title, alt text, long description, text content) but may contain factual errors.

**Test:** Refresh the page, switch to Image Describer, confirm the dropdown shows three options.

---

### File 4 of 5: `image-describer/image-describer-controller-generate.js`

1. **Progress stages** (after `QWEN_PROGRESS_STAGES`):
   ```javascript
   const LFM2VL_PROGRESS_STAGES = {
     LOADING_LFM2VL: {
       message: 'Loading LFM2-VL model\u2026',
       icon: 'download',
       weight: 40,
     },
     GENERATING_LFM2VL: {
       message: 'Generating description locally\u2026',
       icon: 'aiSparkle',
       weight: 55,
     },
     FINALISING_LFM2VL: {
       message: 'Finalising\u2026',
       icon: 'check',
       weight: 5,
     },
   };
   ```

2. **`showProgress()` lookup** — Add `LFM2VL_PROGRESS_STAGES[stage]` to the fallback chain.

3. **Progress bar generating class** — Add `stage === 'GENERATING_LFM2VL'` to the `isGenerating` check.

4. **`buildLfm2VlPrompt()` method** — Simple free-form prompt (same as FastVLM default):
   ```javascript
   buildLfm2VlPrompt() {
     return 'Describe this image in detail for accessibility purposes.';
   },
   ```

5. **Route in `generateLocally()`** — Before the existing Qwen check, add:
   ```javascript
   if (localModel === 'lfm2vl') {
     return this.generateLocallyLfm2Vl();
   }
   ```

6. **`generateLocallyLfm2Vl()` method** — Clone the FastVLM generation path (the default `generateLocally()` body) with:
   - Gateway call: `gateway.generateLfm2VlDescription()` instead of `gateway.generateLocalDescription()`
   - Status check: `gateway.getLfm2VlStatus()` instead of `gateway.getFastVLMStatus()`
   - Progress stages: `LOADING_LFM2VL`, `GENERATING_LFM2VL`, `FINALISING_LFM2VL`
   - Prompt: `this.buildLfm2VlPrompt()`
   - Display name: `'LFM2-VL 450M'` / `'LFM2-VL 450M (Local)'`
   - Use `_renderPlainTextAsHtml()` for output (free-form, not markdown)
   - No accuracy warning (unlike Qwen)

**Test:** Upload a real image, select LFM2-VL from the dropdown, click Generate, verify the full flow works end-to-end with progress stages.

---

### File 5 of 5: `image-describer/image-describer-controller-model.js`

1. **`_updateLocalModelInfo()`** — Add LFM2-VL to the "any local ready" check:
   ```javascript
   const lfm2vlState = mm.getModelState('lfm2vl');
   ```
   And include it in the `anyLocalReady` check alongside FastVLM and Qwen states.

**Test:** Select LFM2-VL, verify the status display updates correctly.

---

## Critical Rules

- **One file at a time.** Complete and test each file before moving to the next.
- **Do not modify files not listed above.** Especially do not touch the spike harness.
- **Clone FastVLM patterns exactly** — LFM2-VL uses the identical class, message format, processor order, and decode method. The ONLY differences are: model ID, flat dtype config, variable/function names, log prefixes, emit keys.
- **British spelling** in all comments and user-facing strings.
- **IIFE pattern** — all image-describer files use IIFEs with `window` globals, not ES6 import/export.
- **No NPM** — all dependencies via CDN or local files.
- **WCAG 2.2 AA** for any UI changes (the `<option>` element is inherently accessible).
