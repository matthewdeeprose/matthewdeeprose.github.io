# Building an accessible "back to top" link at the end of `<main>`

A "back to top" link returns you to the top of a long page. The hard part is not the scroll — it is the keyboard focus. If you move only the scroll position, a keyboard user's focus stays on the link, so their next Tab takes them into whatever follows the link in the DOM. When the link sits at the end of your `<main>`, that next thing is your footer. You move both the viewport and the focus, so the keyboard user continues from the top of the content instead of dropping into the footer.

This article shows you how to build one with semantic HTML and vanilla JavaScript. You place the control as a static `<a href>` as the last child of `<main>`, after your content but before the footer, and the scroll respects the user's reduced-motion preference.

## What you are building

You want three things to happen when the user activates the link:

* The page scrolls to the top.
* Keyboard focus moves to a target near the top, so the next Tab lands in the content rather than the footer.
* The scroll animation honours `prefers-reduced-motion`.

A common starting point handles the scroll and a focus move, but hard-codes one element id and always jumps instantly:

```js
function topFunction() {
  document.body.scrollTop = 0;
  document.documentElement.scrollTop = 0;
  document.getElementById('skipToContent').focus();
}
```

Moving focus is right, but this assumes every page has an element with the id `skipToContent` and ignores motion preferences. You can make it work across pages and respect those preferences.

## Why a link and not a button

A "back to top" control points to a location on the page, so an anchor with a fragment identifier is the correct semantic element. It works without JavaScript: the browser jumps to `#top` on its own. The JavaScript then enhances that baseline by smoothing the scroll and managing focus.

A `<button>` needs JavaScript to do anything at all. The link degrades gracefully, which is why you prefer it here.

## Why the end of `<main>` matters for focus

Placing the link as the last element inside `<main>` makes the focus move the point of the whole pattern, not an optional extra. After the link in the DOM comes your `<footer>` — site navigation, contact links, legal text. A keyboard user who activates a link that only scrolls keeps their focus on that link, so their next Tab moves them forward into the footer, away from the content they scrolled back to read. When you move focus to the top, the next Tab continues from the top of the page, which is what the user expects.

So the order of operations carries real weight here: scroll to the top, then move focus to a target at the top. Get either half wrong and the keyboard experience breaks.

## The HTML

You need two pieces of markup: the target at the top, and the link at the end of `<main>`. Give the link a real `href` that points to your focus target.

### The target at the top

Two approaches work, and which you pick depends on what already sits at the top of your page.

#### Approach 1: target your existing skip link

Most accessible sites already start with a "skip to content" link as the first focusable element. If yours does, point the back-to-top link at it. The skip link is already focusable, so you need no extra attributes.

```html
<body>
  <a id="top" class="skip-link" href="#main">Skip to content</a>
  <!-- header, nav, etc. -->
</body>
```

#### Approach 2: target a heading with tabindex="-1"

Some pages have no skip link, or you want focus to land on the page's first heading so a screen reader announces it. A heading is not focusable by default, so you add `tabindex="-1"`. This makes the element focusable by script without adding it to the Tab order, so you do not change how sighted keyboard users move through the page.

```html
<main>
  <h1 id="top" tabindex="-1">Annual report 2024/25</h1>
  <!-- page content -->
</main>
```

Use whichever element makes sense for the page. A documentation page might target its skip link; an article might target its `<h1>`. The id `top` is the anchor both the link and the script use.

### The link at the end of `<main>`

Put the link after your content but before the closing `</main>` tag, so it is the last thing inside the main content region:

```html
<main>
  <h1 id="top" tabindex="-1">Annual report 2024/25</h1>
  <!-- all your page content -->

  <a class="back-to-top" href="#top">
    <span aria-hidden="true" data-icon="arrow-up"></span>
    Back to top
  </a>
</main>

<footer>
  <!-- site navigation, contact, legal -->
</footer>
```

The visible text "Back to top" carries the meaning. The icon is decorative, so you hide it from assistive technology with `aria-hidden="true"` and pull it from your icon library rather than using an emoji. The `href="#top"` gives you the no-JavaScript fallback.

Keeping the link inside `<main>` also keeps it inside the page's main landmark, where a screen-reader user reading to the end of the content meets it as the natural close of that content, ahead of the footer landmark.

## The JavaScript

The script intercepts the click, scrolls with the user's motion preference in mind, then moves focus to the target. Here it is in full, followed by an explanation of each part.

```js
/**
 * Accessible "back to top" link.
 *
 * Enhances a static <a href="#top"> placed at the end of <main> so that
 * activating it:
 *   - scrolls to the top (instantly if the user prefers reduced motion)
 *   - moves keyboard focus to the top target, so the next Tab lands in the
 *     page content rather than the footer that follows <main>.
 */
(function () {
  'use strict';

  // --- Logging ---------------------------------------------------------
  const LOG_PREFIX = '[back-to-top]';
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;
  let logLevel = LOG_LEVELS.WARN;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return LOG_LEVELS[level] <= logLevel;
  }
  const log = {
    error: (...a) => shouldLog('ERROR') && console.error(LOG_PREFIX, ...a),
    warn: (...a) => shouldLog('WARN') && console.warn(LOG_PREFIX, ...a),
    info: (...a) => shouldLog('INFO') && console.info(LOG_PREFIX, ...a),
    debug: (...a) => shouldLog('DEBUG') && console.debug(LOG_PREFIX, ...a)
  };

  // --- Behaviour -------------------------------------------------------
  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function backToTop(event) {
    const link = event.currentTarget;
    const targetId = link.getAttribute('href').slice(1);
    const target = document.getElementById(targetId);

    if (!target) {
      log.warn('No element found for target id:', targetId);
      return; // Let the browser handle the link normally.
    }

    event.preventDefault();

    const behaviour = prefersReducedMotion() ? 'auto' : 'smooth';
    log.debug('Scrolling to top with behaviour:', behaviour);
    window.scrollTo({ top: 0, left: 0, behavior: behaviour });

    // Move focus so the next Tab continues from the top, not the footer.
    target.focus();

    // If the browser scrolled the element into view to focus it, undo that
    // so we stay at the very top of the page.
    window.scrollTo({ top: 0, left: 0, behavior: behaviour });

    if (document.activeElement !== target) {
      log.warn('Focus did not move to target:', targetId);
    }
  }

  function init() {
    const links = document.querySelectorAll('.back-to-top');
    if (links.length === 0) {
      log.info('No .back-to-top links on this page.');
      return;
    }
    links.forEach((link) => link.addEventListener('click', backToTop));
    log.info('Initialised', links.length, 'back-to-top link(s).');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### How the focus and scroll work together

The order matters. You scroll first, then call `target.focus()`. Calling `focus()` on an element that is off-screen makes the browser scroll it into view, which can leave you a little below the top if your target has margin above it or sits under a sticky header. The second `scrollTo` corrects that, so you always land at the very top regardless of where the focus target sits.

Because the focus target either is the skip link (naturally focusable) or carries `tabindex="-1"`, `focus()` succeeds in both approaches above. The next Tab then continues from that element. The user moves forward into the content at the top rather than into the footer that sits after `<main>`.

### How reduced motion is handled

`scrollTo` takes a `behavior` of `smooth` or `auto`. You check `prefers-reduced-motion: reduce` and pass `auto` (an instant jump) when the user asks for less motion, and `smooth` otherwise. The script reads the live value at click time, so it keeps working if the user changes the setting during the session.

### Why the script reads the target from the href

The script reads the target id from the link's own `href`, so different pages point at different targets without touching the JavaScript. One page links to `#top` on its skip link; another links to `#top` on its heading. The script does not care which, as long as the id exists. If it does not, the warning fires and the browser falls back to its native jump.

## The CSS

You need little. A skip link stays visually hidden until focused, and a `tabindex="-1"` heading should not show a focus ring when clicked with a mouse — show it only for keyboard users with `:focus-visible`.

```css
/* Skip link: hidden until focused. */
.skip-link {
  position: absolute;
  left: -9999px;
}
.skip-link:focus {
  left: 1rem;
  top: 1rem;
}

/* Don't show an outline on a programmatically focused heading
   unless the user is navigating by keyboard. */
[tabindex="-1"]:focus:not(:focus-visible) {
  outline: none;
}

/* The link itself: a normal, static link at the end of the main content. */
.back-to-top {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
```

Avoid relying on CSS `scroll-behavior: smooth` alone, because it gives you no way to vary by motion preference at the moment of the click. Driving the scroll from JavaScript keeps the motion check and the focus move in one place.

## Testing it

Check these by hand before you ship:

* Tab to the link, press Enter, and confirm focus lands at the top. Press Tab once more and confirm you move into the content, not the footer.
* Turn off JavaScript and confirm the link still jumps to the target.
* Set "reduce motion" in your operating system and confirm the scroll jumps instantly instead of animating.
* Use a screen reader, read to the end of `<main>`, and confirm that activating the link announces the skip link or heading you focused.
* Point the link at a missing id and confirm the console warning fires and the browser still jumps.

## WCAG notes

This pattern supports several WCAG 2.2 AA requirements directly. Moving focus to the top satisfies the keyboard expectation under 2.1.1 Keyboard, because the next interactive element a keyboard user reaches is the content at the top rather than the footer that follows `<main>`. Honouring `prefers-reduced-motion` supports 2.3.3 Animation from Interactions. Keeping the visible "Back to top" text, rather than an icon alone, supports 2.4.4 Link Purpose and 1.1.1 Non-text Content, since the decorative icon stays hidden from assistive technology.
