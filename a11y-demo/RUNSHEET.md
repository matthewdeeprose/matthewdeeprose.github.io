# 2-minute run sheet — accessible form before/after

A live demo for a mixed audience. Two pages that look the same; one is unusable
with a screen reader, the other works. You run the tools live; the pages stay
pure (no embedded results).

**Before you start:** preview server up on `http://localhost:8080` (VS Code
"Preview on Web Server"). Have a terminal ready for `/a11y-sr` and `/a11y-audit`.
`/a11y-sr` is the *virtual* (simulated) reader — name/role/reading-order, not
real NVDA speech.

---

## Part 1 — the BROKEN form (~60s)

1. **Open** `a11y-demo/before.html`.
   > "A normal conference registration form. Nothing looks wrong, does it?"

2. **Run** `/a11y-sr a11y-demo/before.html`.
   > "This is what a blind user hears — the first box has no name, just 'text
   > box', and the Register button isn't even announced as a button."

3. **Point at** the campus group in the reader output.
   > "And the campus options are read out with no heading — you never hear that
   > you're choosing a campus."

4. **Submit** the form with the email empty (click Register).
   > "I'll make a mistake on purpose. A red outline appears — but a screen reader
   > is told nothing, and that message is too faint for most people to read."

5. **Run** `/a11y-audit a11y-demo/before.html`.
   > "The automated checkers agree — real failures on both: a missing label, an
   > ungrouped set of choices, and no page language."

## Part 2 — the FIXED form (~60s)

6. **Open** `a11y-demo/after.html`.
   > "Here's the same form, rebuilt. To you, it looks identical."

7. **Run** `/a11y-sr a11y-demo/after.html`.
   > "Now the screen reader names every control, announces 'Preferred campus' as
   > a group, and calls Register a button."

8. **Submit** with the email empty (click Register).
   > "Same mistake — but now focus jumps to a clear, readable error tied to the
   > field, so the user learns exactly what to fix."

9. **Run** `/a11y-audit a11y-demo/after.html`.
   > "And the checkers are clean — zero failures."

---

## Closing line

> "Same appearance, completely different experience. The difference isn't how it
> looks — it's the HTML underneath."

## If a tool says the server is down

Start the VS Code "Preview on Web Server" and retry. Nothing to fix on the pages.

## Cheat sheet — what each tool shows

| | before | after |
| --- | --- | --- |
| `/a11y-sr` (reader) | Full name unnamed; "?" and Register not controls; campus has no group | every control named; campus is a group; Register is a button |
| `/a11y-audit` IBM | 8 violations | 0 (only documented potentials) |
| `/a11y-audit` pa11y/axe | 2 violations | 0 |
| live submit (empty) | red outline only, nothing announced | focus moves to an announced, readable, field-tied error |
