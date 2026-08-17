# Dev-only console tools

This folder holds standalone developer tools for testing and grounding workflows. Both load automatically through `tools.html`, so their console commands are always available once a page loads. Neither has a user interface, neither is a production module, and no feature depends on either. They are safe to remove.

These are dev-time tools. Use them in DevTools while testing. A real user never sees them, because there is nothing to see — they expose console commands only.

## `mathpix-wipe.js` — clear MathPix saved data (`window.mathpixWipe`)

A console helper to wipe MathPix local-storage data back to a clean slate during testing. It replaces the ad-hoc `localStorage.removeItem(...)` lines you would otherwise paste by hand.

It clears three independent storage families the app keeps separate:

- The live editor draft — the single `mathpix-mmd-session` key (the document you are editing now, plus undo/redo history).
- The saved resume snapshots — every `mathpix-resume-session-*` key (one per save, per ZIP; recovery reads these on a ZIP reload).
- The Context-tab settings — `mathpix-context-current` and `mathpix-context-current-source` (audience and subject metadata used to improve AI descriptions).

### Usage

```javascript
mathpixWipe.inspect(); // read-only: list every MathPix key by family with its size
mathpixWipe(); // clear all three families, report what was removed
mathpixWipe({ dryRun: true }); // list what WOULD be removed, delete nothing
mathpixWipe({ families: ["resume"] }); // clear only the resume snapshots
mathpixWipe({ keepContext: true }); // clear draft + resume, keep the Context settings
mathpixWipe({ allMathpix: true }); // clear EVERY localStorage key starting "mathpix"
```

Reload the page after wiping for a clean session.

### Console-only by design

`mathpixWipe()` is a destructive total wipe with no undo. It must never be wired to a user-clickable surface, so it lives as a console command only. The `allMathpix` catch-all is opt-in: a plain `mathpixWipe()` never touches keys outside the three named families (such as the app key), so it will not break an authenticated session by accident.

This tool is MathPix-specific. The key families it knows about belong to the MathPix lane.

## `workflow-trace.js` — record a workflow to one timeline (`window.trace`)

A general-purpose workflow recorder. It is **not** MathPix-specific — it captures clicks, fetch and XHR traffic, and calls to any function you name, on any feature in the app. Use it to ground a shared understanding of how a workflow behaves, and to seed console tests from a real run rather than guesswork.

It captures, in order: clicks (with a usable CSS selector and the element text), fetch requests and responses, XMLHttpRequest requests and responses, and calls to functions you name (with their arguments and return values). The timeline survives a page reload, so a workflow that includes an F5 is captured as one continuous story.

### Usage

```javascript
trace.reset(); // clean slate — clears any prior timeline and flags
trace.start(); // begin capturing network and clicks
trace.watch(window, ["doThing"]); // also trace named global functions
trace.watch(myApp, ["save", "load"]); // or named methods on an object
trace.step("loaded the file"); // mark a named stage in the timeline
trace.snapshot("after-save", () => ({
  /* any state to capture */
}));
// ... click through your workflow; F5 is fine, capture auto-resumes ...
trace.export(); // download the timeline as JSON
trace.stop(); // restore everything it patched
trace.selfTest(); // prove the reload-boundary flush still works (run, reload, run again)
trace.resumeKey(); // which mathpix-resume-session key this trace belongs to
trace.resumeKeyTest(); // prove the resume-key resolver: newest wins, loadedFromKey preferred
```

Inspect the live timeline at any point with `trace.log`.

### Key behaviours

- **Survives reloads.** The timeline persists to `localStorage` and is restored on the next page load, so a refresh in the middle of a workflow does not lose the capture. A `{type:'reload'}` marker shows where the F5 happened.
- **Auto-resumes after a reload.** If capture was running before an F5, it restarts itself on load — no need to re-run `trace.start()` in the blank post-refresh console.
- **State snapshots.** `trace.snapshot(label, fn)` runs `fn()` and records whatever object it returns, so the timeline holds not just events but the application or storage state at each checkpoint. Pass `{ full: true }` to capture full strings instead of truncating.
- **Stage markers.** `trace.step(label)` records a named stage, so a capture reads as ordered steps rather than raw event soup.
- **Full teardown.** `trace.reset()` stops capture, clears the timeline, and removes both `localStorage` keys, leaving no residue. `trace.clear()` empties the timeline but keeps the active flag.

The `trace.config` object tunes truncation and depth (`maxString`, `snapshotMaxString`, `maxItems`, `maxDepth`, `maxBody`, and an `ignore` list of URL substrings to skip).

### Lessons for the roadmap version

The tracer is the prototype for a proper, documented capture tool that will seed automated tests across the alt-text roadmap and beyond. These lessons are recorded so a future build does not relearn them:

- **Binding a trace to its resume key is solved by matching on filename and newest timestamp, not first match.** Every autosave writes a *new* `mathpix-resume-session` key, so one source file owns a growing family of timestamped keys; the newest is the live one, and a first-match selector lands on a stale sibling and reports the wrong state. `trace.resumeKey()` resolves the key by filename base-name and newest timestamp, and prefers `loadedFromKey` — the key the app actually recovered from — when it is set, since on the recovered path that is ground truth. It deliberately does **not** copy the app's content-differs gate: that gate compares against live page state rather than the stored key set, so it is a property of the running page and folding it in would make the resolver fragile. `trace.resumeKeyTest()` guards the resolver.
- **Snapshot timing matters.** A snapshot taken immediately after a save reads the synchronous store correctly, but a snapshot taken mid-edit captures a half-typed field. Snapshot at settled checkpoints, and instrument the methods you care about (for example the recovery method) so their absence from a trace is not mistaken for them not running.
- **The capture-to-test convention, demonstrated.** The shape is four steps: record the behaviour with a real capture; neutralise the path that could let the test pass by accident; prove the genuine mechanism across the boundary that actually matters; then clean up so no residue is left behind. `trace.selfTest()` is the worked example — it arms itself by dropping a probe marker and cancelling the debounced write, so only the synchronous flush can carry that marker across a reload, and after the reload it confirms the marker survived. The test therefore proves the flush, not how fast the reload happened. The same arm-then-check shape suits any behaviour that must survive a reload or session boundary, so future guards can follow it rather than reinvent it.
