**Human impact**: Low-vision users rely on sufficient contrast to read text and identify interactive elements. Colour-blind users - approximately 8 per cent of men and 0.5 per cent of women - cannot distinguish elements differentiated by colour alone. Poor contrast causes eye strain for everyone in bright environments, on lower-quality screens, or when viewing in direct sunlight. When we get contrast right, content becomes more readable for everyone.

---

### 2.1 Text Contrast

**WCAG**: 1.4.3 Contrast (Minimum) - AA

**Requirement**: 4.5:1 for normal text, 3:1 for large text (18pt/24px+ or 14pt/18.5px+ bold)

```css
/* Rich Black on white - 18.9:1, passes comfortably */
.body-text {
  color: #00131d;
}

/* Neutral 1 on white - 7.27:1, passes */
.secondary-text {
  color: #495961;
}

/* Neutral 3 on white - 2.21:1, fails */
.subtle-text {
  color: #9fb1bd; /* Do not use for text */
}
```

**Common questions**:

| Scenario                     | Rule                                                                                                                                   |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Placeholder text             | Must meet 4.5:1 - it conveys information. Use Neutral 1 (#495961) not Neutral 3.                                                       |
| Disabled text                | Exempt, but aim for 3:1 to remain legible. Neutral 2 (#758D9A) on Neutral 4 (#E1E8EC) provides 2.8:1 - acceptable for disabled states. |
| Text over images             | Measure against the worst-case area of the image, or add a semi-transparent overlay.                                                   |
| Text on coloured backgrounds | Recalculate contrast against the new background. Rich Black on Horizon 1 (yellow) = 10.9:1 ✓                                           |
| Links within body text       | Must be distinguishable from surrounding text (see Section 5).                                                                         |

**Gherkin test**:

```gherkin
Given any text element on the page (including placeholders)
When I measure its foreground colour against its background colour
Then the contrast ratio is at least 4.5:1
  (or 3:1 if the text is 24px+ or 18.5px+ bold)
```

**Tools**:

- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) - quick ratio calculation
- [Who Can Use](https://www.whocanuse.com/) - shows how colours appear to people with different vision types
- [Colour Contrast Analyser (desktop)](https://www.tpgi.com/color-contrast-checker/) - includes colour picker for measuring on-screen elements
- [Accessibility Colour Matrix](https://matthewdeeprose.github.io/matrix/matrix.html) - pre-calculated contrast ratios for University of Southampton brand colours
- [Contrast Cards](https://matthewdeeprose.github.io/contrastCards) - brand colour reference with contrast ratings
- [Accessibility Insights](https://chromewebstore.google.com/detail/accessibility-insights-fo/pbjjkligggfmakdaogkfomddhfmpjeni) - will automatically detect some but not all contrast issues.

---

### 2.2 Non-text Contrast (UI Components)

**WCAG**: 1.4.11 Non-text Contrast - AA

**Requirement**: 3:1 for the visual boundary of UI components and their states

**What counts as the "visual boundary"?**

You need 3:1 contrast for whatever tells the user "here is a control you can interact with."

| Component style                        | What needs 3:1                                                                |
| -------------------------------------- | ----------------------------------------------------------------------------- |
| Button with background fill            | Background colour against page background                                     |
| Button with border only (ghost button) | Border colour against page background                                         |
| Input with border                      | Border colour against page background                                         |
| Input with background fill only        | Background colour against page background                                     |
| Icon-only button                       | Icon colour against button background (icons are graphical objects, not text) |
| Checkbox or radio                      | Border/outline against page background                                        |

```css
/* Ghost button - border must hit 3:1 against page */
.btn-ghost {
  background: transparent;
  border: 2px solid #005c84; /* Marine 1: 7.33:1 against white - passes */
  color: #005c84;
}

/* Filled button - background must hit 3:1 against page */
.btn-primary {
  background: #005c84; /* Marine 1: 7.33:1 against white - passes */
  border: none;
  color: #ffffff;
}

/* Input - border must hit 3:1 against page */
.form-input {
  border: 2px solid #495961; /* Neutral 1: 7.27:1 against white - passes */
  background: #ffffff;
}
```

**Common questions**:

| Scenario                          | Rule                                                                                                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Icon with accompanying text label | Icon only needs 3:1 (SC 1.4.11). The text carries meaning.                                                                                                   |
| Icon alone (no text)              | Icon needs 3:1 (SC 1.4.11). It's a graphical object, not text. **Note** we should never use icon only buttons - every button should have a visual text label |
| Decorative icons                  | No contrast requirement if purely decorative (use `aria-hidden="true"`).                                                                                     |
| Component on coloured background  | Measure against the actual background, not the page.                                                                                                         |

**Gherkin test**:

```gherkin
Given a button, input, checkbox, or other interactive component
When I identify its visual boundary (fill, border, or icon)
Then that boundary has at least 3:1 contrast against adjacent colours
```

---

### 2.3 State Changes (Hover, Focus, Selected)

**WCAG**: 1.4.11 Non-text Contrast - AA

**Requirement**: Each distinct state must be visually distinguishable; focus indicators need 3:1

**The key question**: Can the user tell the component changed state?

| State change              | What to check                                             |
| ------------------------- | --------------------------------------------------------- |
| Default → Hover           | The change must be perceptible (not a slight shade shift) |
| Default → Focus           | Focus indicator must have 3:1 against adjacent colours    |
| Default → Selected/Active | Selected state must differ visibly from unselected        |
| Default → Disabled        | Exempt from contrast requirements, but must look disabled |

**Hover states - practical guidance**:

The hover state doesn't need 3:1 contrast against the default state. It needs to be **perceptibly different**. WCAG doesn't specify a ratio for state-to-state change, but these patterns work reliably:

```css
/* Pattern 1: Background colour change */
.btn-primary {
  background: #005c84; /* Marine 1 */
}

.btn-primary:hover {
  background: #002e3b; /* Prussian - noticeably darker */
}

/* Pattern 2: Add outline or border */
.card:hover {
  outline: 2px solid #005c84;
}

/* Pattern 3: Multiple cues (safest) */
.link:hover {
  text-decoration: underline;
  background: #e1e8ec; /* Neutral 4 */
}
```

**Focus indicator requirements**:

Focus indicators need more rigour than hover - keyboard users depend on them entirely. A single-colour outline can fail against certain backgrounds, so use a layered approach that works universally:

```css
:focus-visible {
  /* Transparent outline ensures Windows High Contrast Mode 
     still renders a visible indicator - HCM replaces colours 
     but preserves outline structure */
  outline: 2px solid transparent;

  /* Layered box-shadow creates a "sandwich" effect:
     - Inner white ring provides contrast on dark backgrounds
     - Middle dark ring provides contrast on light backgrounds  
     - Outer white glow softens edges and adds visibility */
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px #002e3b,
    /* Prussian */ 0 0 4px 8px #ffffff;
}

/* Never do this without a replacement */
:focus {
  outline: none; /* Breaks keyboard navigation */
}
```

**Why this technique works**:

| Layer                            | Purpose                                                                   |
| -------------------------------- | ------------------------------------------------------------------------- |
| `outline: 2px solid transparent` | Preserved by High Contrast Mode (HCM replaces colour but keeps structure) |
| Inner white ring (2px)           | Visible against dark backgrounds like Marine 1 buttons                    |
| Middle Prussian ring (4px)       | Visible against light backgrounds like white page                         |
| Outer white glow (8px)           | Softens edge, adds visibility on mid-tone backgrounds                     |

**Common questions**:

| Scenario                                        | Rule                                                                                      |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Windows High Contrast Mode overrides my colours | Expected behaviour. Use `outline: transparent` so HCM can replace it with system colours. |
| Focus on dark background                        | The layered box-shadow technique handles this automatically.                              |
| Focus on patterned background                   | The white outer glow creates separation from complex backgrounds.                         |

**Gherkin tests**:

```gherkin
Given an interactive element in its default state
When I hover over it with a pointer
Then the visual change is clearly perceptible

Given an interactive element
When it receives keyboard focus
Then a visible focus indicator appears with at least 3:1 contrast against adjacent colours

Given a toggle, tab, or selectable item
When I compare selected and unselected states
Then the difference is distinguishable without relying on colour alone
```

**Tools**:

- [Focus Colour Demonstration](https://codepen.io/matthewdeeprose/pen/mdxpBEZ) - live example of universal focus indicator technique

---

### 2.4 Colour as Sole Indicator

**WCAG**: 1.4.1 Use of Colour - A

**Requirement**: Never use colour alone to convey information

**Common violations**:

| Bad pattern                              | Fix                                        |
| ---------------------------------------- | ------------------------------------------ |
| Red border = error, no other indication  | Add icon + error message text              |
| Green/red status dots                    | Add labels: "Active", "Inactive"           |
| "Required fields are in red"             | Add asterisk or "(required)" text          |
| Link only distinguished by colour        | Add underline or other visual treatment    |
| Chart lines distinguished only by colour | Add patterns, labels, or direct annotation |

```html
<!-- Bad: colour-only error state -->
<input style="border-color: #e73037;" />

<!-- Good: colour plus icon and text -->
<input
  style="border-color: #e73037;"
  aria-invalid="true"
  aria-describedby="email-error"
/>
<span id="email-error">
  <span aria-hidden="true">⚠️</span> Enter a valid email address
</span>
```

**Gherkin test**:

```gherkin
Given information conveyed through colour (errors, status, required fields, links)
When I view the page in greyscale or simulate colour blindness
Then the information remains distinguishable through text, icons, patterns, or position
```

**Tools**:

- [Toptal Colorblind Filter](https://www.toptal.com/designers/colorfilter) - simulate colour blindness on any URL
- Chrome DevTools → Rendering → Emulate vision deficiencies

---

### 2.5 Complete Example: Accessible Button

This example ties together all contrast requirements for a single component.

**What we need to check**:

| Check                          | Requirement                 | Colours to compare                       |
| ------------------------------ | --------------------------- | ---------------------------------------- |
| Button background against page | 3:1 (UI component boundary) | Marine 1 (#005C84) vs White (#FFFFFF)    |
| Button text against button     | 4.5:1 (text contrast)       | White (#FFFFFF) vs Marine 1 (#005C84)    |
| Decorative icon against button | 3:1 (graphical object)      | White (#FFFFFF) vs Marine 1 (#005C84)    |
| Hover state                    | Perceptibly different       | Prussian (#002E3B) vs Marine 1 (#005C84) |
| Focus indicator against page   | 3:1 (focus visibility)      | Prussian (#002E3B) vs White (#FFFFFF)    |
| Focus indicator against button | 3:1 (focus visibility)      | White inner ring vs Marine 1 (#005C84)   |

```html
<button class="btn-primary" type="submit">
  <span aria-hidden="true">📧</span> Send Message
</button>
```

```css
:root {
  /* University of Southampton brand colours */
  --page-bg: #ffffff;
  --marine-1: #005c84; /* 7.33:1 against white */
  --prussian: #002e3b; /* 14.4:1 against white */
  --btn-text: #ffffff;
}

.btn-primary {
  background: var(--marine-1);
  color: var(--btn-text);
  border: none;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  cursor: pointer;
}

.btn-primary:hover {
  background: var(--prussian); /* Perceptibly darker than default */
}

.btn-primary:focus-visible {
  /* Transparent outline for High Contrast Mode compatibility */
  outline: 2px solid transparent;

  /* Layered focus ring visible on any background */
  box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px var(--prussian), 0 0 4px 8px #ffffff;
}
```

**Contrast audit for this button**:

| Check                                           | Calculation       | Result            |
| ----------------------------------------------- | ----------------- | ----------------- |
| Button (#005C84) vs page (#FFFFFF)              | 7.33:1            | ✓ Passes 3:1      |
| Text (#FFFFFF) vs button (#005C84)              | 7.33:1            | ✓ Passes 4.5:1    |
| Focus inner ring (#FFFFFF) vs button (#005C84)  | 7.33:1            | ✓ Passes 3:1      |
| Focus Prussian ring (#002E3B) vs page (#FFFFFF) | 14.4:1            | ✓ Passes 3:1      |
| Hover (#002E3B) vs default (#005C84)            | Perceptible shift | ✓ Distinguishable |

**Dark background variant**:

When the page background changes, recalculate everything.

```css
.dark-section {
  --page-bg: #00131d; /* Rich Black */
  --btn-bg: #74c9e5; /* Marine 2: light enough to see on dark */
  --btn-text: #00131d; /* Rich Black text on light button */
  --btn-hover: #b3dbd2; /* Marine 4: lighter on dark = perceptible hover */
}
```

**Disabled button state**:

WCAG exempts disabled controls from contrast requirements, but maintaining some contrast aids usability.

```css
.btn-primary:disabled {
  background: #e1e8ec; /* Neutral 4 */
  color: #758d9a; /* Neutral 2: 2.8:1 against Neutral 4 */
  cursor: not-allowed;
  /* Exempt from WCAG contrast, but still somewhat legible */
}
```

**Common questions**:

| Scenario                                        | Rule                                                                                                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Disabled buttons - do they need contrast?       | No. WCAG exempts disabled controls, but consider adding visual cues beyond colour (e.g., "Currently unavailable" text) for clarity.                                          |
| Windows High Contrast Mode overrides my colours | Expected behaviour. Test that your button remains identifiable when system colours replace yours. The transparent outline technique preserves the focus indicator structure. |
| Emoji icons render differently across platforms | Consider inline SVG for visual consistency. Hide decorative icons with `aria-hidden="true"` regardless of format.                                                            |
| Adjacent buttons with different colours         | Each button must meet contrast requirements independently against the shared background.                                                                                     |

**Gherkin test (comprehensive)**:

```gherkin
Given a button on the page
Then the button background has at least 3:1 contrast against the page background
And the button text has at least 4.5:1 contrast against the button background
And any decorative icon has at least 3:1 contrast against the button background

When I hover over the button
Then the visual change from default state is clearly perceptible

When the button receives keyboard focus
Then a focus indicator appears with at least 3:1 contrast against all adjacent colours
And the focus indicator remains visible in Windows High Contrast Mode
```

**Tools**:

- [Who Can Use](https://www.whocanuse.com/) - check contrast ratios and see how colours appear to people with different vision types
- [Accessibility Colour Matrix](https://matthewdeeprose.github.io/matrix/matrix.html) - pre-calculated contrast ratios for University of Southampton brand colours
- [Contrast Cards](https://matthewdeeprose.github.io/contrastCards) - brand colour reference with contrast ratings
- [Focus Colour Demonstration](https://codepen.io/matthewdeeprose/pen/mdxpBEZ) - universal focus indicator technique
- [WCAG Contrast Requirements Demo](https://codepen.io/matthewdeeprose/pen/contrast-demo-soton) - interactive demonstration of all contrast requirements using brand colours

---

**Section 2 checklist**:

Before signing off a component, verify:

- [ ] Text contrast: 4.5:1 for normal text, 3:1 for large text (24px+ or 18.5px+ bold)
- [ ] UI boundary contrast: 3:1 against surrounding background
- [ ] Icon contrast: 3:1 against background (icons are graphical objects, not text)
- [ ] Focus indicator: 3:1 against all adjacent colours, visible in High Contrast Mode
- [ ] Hover state: perceptibly different from default
- [ ] Disabled state: exempt from contrast, but still identifiable as disabled
- [ ] No colour-only meaning: information works in greyscale

---
