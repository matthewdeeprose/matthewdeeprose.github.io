# TTS Spike Testing Protocol

**Purpose:** Walk through TTS spike harness tests on each machine, collect results, and feed them back to Claude Code for recording in `tts-masterplan.md` Section 9.

**Machines to test:** RTX 4070, RTX 4060, GTX 1650 SUPER, UM790 (780M), HP Envy (Vega 10)

---

## Before You Start (Each Machine)

1. Open `tools.html` via "Preview on Web Server" in VS Code.
2. Open the browser console (F12 → Console tab).
3. Verify the harness loaded:

```js
typeof TTSSpike.evaluate === 'function'
// Should return: true
```

4. Sanity check — list engines:

```js
TTSSpike.listEngines()
```

Confirm a table appears with 5 engines (kokoro, supertonic, supertonic-v2, speecht5, webspeech). No need to paste this back.

---

## Test 1: Web Speech API (Instant — No Download)

Run this first on every machine. It is instant and establishes a quality baseline.

```js
await TTSSpike.evaluate({ engine: 'webspeech' })
TTSSpike.printSummary()
```

Listen to the audio that plays during the test. Then export the full results:

```js
TTSSpike.exportJSON()
```

### What to paste back

- **Machine and browser** (e.g. "RTX 4070, Chrome" or "UM790, Firefox")
- **The printSummary() table** from the console
- **The exportJSON() output** (full JSON)
- **Subjective quality rating 1–5:**
  - 1 = Robotic, clearly synthetic
  - 2 = Understandable but unpleasant
  - 3 = Acceptable, generic TTS
  - 4 = Good, natural-sounding
  - 5 = Excellent, near-human
- **Name of the best-sounding voice** if you noticed one during the voice test step
- **Any notes** (e.g. "voice 2 was much better", "long text got cut off", "no audio played")

### Multi-browser testing (if time permits)

On at least one machine (ideally the RTX 4070), repeat the Web Speech test in a second browser (e.g. Chrome + Edge) since voice quality varies significantly between browsers.

---

## Test 2: Kokoro TTS (Main Target — ~82 MB Download)

This is the primary neural TTS candidate. First run will download ~82 MB; subsequent runs use the cache.

```js
await TTSSpike.evaluate({ engine: 'kokoro' })
TTSSpike.printSummary()
TTSSpike.exportJSON()
```

### What to paste back

Same as above: machine/browser, printSummary, exportJSON, quality rating 1–5, and notes.

### If Kokoro fails to load

**This is expected and valuable.** The harness tries three loading approaches — discovering which one works (if any) is the whole point of the spike. Just paste the printSummary output showing which steps passed/failed. The log messages above the summary will show which approaches were attempted.

### Second run (cache test)

If Kokoro loaded successfully on the first run, run it again immediately to measure cached load time:

```js
await TTSSpike.evaluate({ engine: 'kokoro' })
TTSSpike.printSummary()
TTSSpike.exportJSON()
```

Note in your paste that this is the "cached run".

---

## Test 3: Supertonic TTS (If Time Permits — ~263 MB Download)

Larger download but most likely to "just work" since it uses the standard pipeline API.

```js
await TTSSpike.evaluate({ engine: 'supertonic' })
TTSSpike.printSummary()
TTSSpike.exportJSON()
```

Paste back the same set of results as above.

---

## Test 4: SpeechT5 (Baseline Comparison — ~60 MB Download)

Older model, 16 kHz output. Expected to sound dated. Useful as a lower-quality baseline.

```js
await TTSSpike.evaluate({ engine: 'speecht5' })
TTSSpike.printSummary()
TTSSpike.exportJSON()
```

Paste back the same set of results.

---

## Test 5: Supertonic v2 (Optional — ~263 MB Download)

Multilingual variant. Only test if Supertonic v1 worked and you want to compare.

```js
await TTSSpike.evaluate({ engine: 'supertonic-v2' })
TTSSpike.printSummary()
TTSSpike.exportJSON()
```

---

## Troubleshooting

### Audio gets stuck or won't stop

```js
TTSSpike.stopAudio()
```

### Harness not loaded

If `typeof TTSSpike.evaluate` returns `'undefined'`, check:
- The script tag is in `tools.html` (search for `tts-spike-harness.js`)
- No console errors on page load
- Try a hard refresh (Ctrl+Shift+R)

### Web Speech voices don't load

Chrome sometimes delays voice loading. If the voice test shows 0 voices, try:

```js
speechSynthesis.getVoices()
```

If that returns an empty array, wait a moment and retry the full evaluation.

### Download seems stuck

Large model downloads (Supertonic especially) can take a while. The console should show progress. If it hangs for more than 5 minutes with no activity, refresh and try again — the partial download should be cached.

---

## Priority Order

If you are short on time, test in this order:

1. **Web Speech API** — instant, test on every machine/browser
2. **Kokoro** — main target, test on every machine
3. **Supertonic** — test on at least one machine (most likely to work via pipeline)
4. **SpeechT5** — test on one machine only (baseline)
5. **Supertonic v2** — only if v1 worked

---

## Template for Pasting Results

Copy and fill in this template when pasting results back:

```
Machine: [e.g. RTX 4070]
Browser: [e.g. Chrome 130]
Engine: [e.g. webspeech]
Run: [fresh / cached]

printSummary:
[paste the console table here]

exportJSON:
[paste the JSON here]

Quality rating: [1–5]
Best voice: [name if applicable]
Notes: [anything notable — truncation, errors, subjective impressions]
```
