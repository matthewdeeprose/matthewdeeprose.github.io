# Set Up Tool — Knowledge Base Article

## Overview

Set Up is the default landing page and centralised configuration hub for the Accessibility Tools platform (`tools.html`). It provides a single place to manage API credentials for all services, view at-a-glance configuration status, download and manage local AI models, and understand what each tool does.

Set Up is the first tool in the navigation bar (radio button group). It loads immediately on every page visit.

---

## What Set Up Manages

### API Credentials (three services)

| Service | localStorage Keys | Fields |
|---------|------------------|--------|
| OpenRouter | `openrouter_api_key` | API key (password input) |
| MathPix | `mathpix-app-id`, `mathpix-app-key` | App ID (text), App Key (password) |
| Ally | `ally-api-token`, `ally-client-id`, `ally-region`, `ally-save-credentials` | Region (select), Client ID (text), API token (password), Remember (checkbox) |

Set Up writes to the **exact same localStorage keys** each tool already reads. No new config store — sync with API clients is automatic.

### Local AI Models (dual-UI with Image Describer)

Set Up displays model cards for six vision models (FastVLM, Qwen3.5, CLIP, Florence-2, Depth Anything, Tesseract) with download/load/unload/remove controls. The same model panel also appears inside Image Describer. Both are driven by the same `ImageDescriberModelManager` business logic and kept in sync via `model:stateChange` events.

### Status Summary

The hero section shows at-a-glance status for all four areas: OpenRouter, MathPix, Ally (configured/not configured), and Local AI Models (X of Y downloaded). Status updates live as credentials or model states change.

### Quick Start Guide

A definition list describing each of the six tools and what credentials they require.

---

## File Structure

```
📦 project root
┣ 📂 setup-tool/
┃ ┣ 📜 setup-tool.js          IIFE module — credentials, status, events
┃ ┗ 📜 setup-tool.css         Responsive layout, credential sections, model grid
┣ 📜 tools.html               Host page — Set Up article, nav radio, TOOL_CONFIG,
┃                              inline scripts (tool switching, OpenRouter IIFE)
┣ 📜 dark.css                 Set Up colour overrides (status badges, borders, inputs)
┣ 📜 light.css                Set Up colour overrides
┣ 📂 image-describer/
┃ ┣ 📜 image-describer-model-manager.js       Business logic (shared, NOT modified)
┃ ┗ 📜 image-describer-model-manager-ui.js    Dual-UI rendering (both locations)
┣ 📂 mathpix-scripts/ui/components/
┃ ┗ 📜 mathpix-ui-manager.js                  Has credentials:changed listener
┗ 📂 ally-scripts/core/
  ┗ 📜 ally-main-controller.js                Has credentials:changed listener
```

---

## Architecture

### Credential Sync Flow

```
Set Up Tool (setup-tool.js)
    │
    ├─► localStorage.setItem() — writes to shared keys
    │
    ├─► EmbedEventEmitter.emit('credentials:changed', { service, action })
    │
    └─► Each tool's config UI listens and refreshes:
            ├── OpenRouter IIFE → loadStoredKey() + checkApiKeyStatus()
            ├── MathPix UI Manager → loadStoredConfig()
            └── Ally Main Controller → loadStoredCredentials()
```

**Bidirectional:** when a user saves credentials in a tool's own config section, that tool emits the same `credentials:changed` event. Set Up listens and refreshes its status summary and form values.

**Idempotent:** both directions cause a harmless re-read from localStorage. No source-tracking is needed.

### Model Manager Dual-UI

```
ImageDescriberModelManager (single instance — business logic)
    │
    ├─► emits model:stateChange via EmbedEventEmitter
    │
    ├─► Image Describer UI (imgdesc-mm-* IDs) — updates on event
    │       inside <details id="imgdesc-model-manager-panel">
    │
    └─► Set Up UI (setup-mm-* IDs) — updates on same event
            inside <div id="setup-model-manager-panel">
```

The UI module (`image-describer-model-manager-ui.js`) uses `getModelElements(modelKey)` which returns an array of elements from both locations. Every rendering function iterates this array, so a single state change updates both panels.

**Cloud Generation** (cloud model selector, cost estimate, verification controls) stays **only** in Image Describer — it is workflow-specific.

**Florence-2 enhancement** and **local model selector** are also Image Describer-only — they require uploaded image context that Set Up does not have.

### Tool Switching Integration

Set Up is registered in `TOOL_CONFIG` (in the tool switching inline script in `tools.html`):

```javascript
"Set Up": {
    articleId: "setup-app",
    displayName: "Set Up",
    announceText: "Switched to Set Up configuration",
    init: function () {
        if (window.SetUpTool) window.SetUpTool.refresh();
        if (window.ImageDescriberModelManagerUI) {
            window.ImageDescriberModelManagerUI.refreshAll();
        }
    },
    cleanup: null,
},
```

The Set Up radio button has `checked` by default. The `initializeToolVisibility()` function reads the checked radio on page load and calls `switchToTool('Set Up', false)`.

---

## HTML Structure (in tools.html)

```
<article id="setup-app">
  <h1>Set Up</h1>

  <!-- Hero: two-column grid on desktop -->
  <div class="setup-hero">
    <div class="setup-status-summary">          Status summary (4 rows)
    <div class="setup-quick-start">             Quick start guide (dl)
  </div>

  <!-- Credentials: full-width stacked -->
  <section class="setup-credentials-section">
    <h2>API Credentials</h2>
    <details class="setup-credential-section" id="setup-openrouter">
      OpenRouter form (key input, save, clear, toggle)
    </details>
    <details class="setup-credential-section" id="setup-mathpix">
      MathPix form (App ID, App Key, save, clear, toggle)
    </details>
    <details class="setup-credential-section" id="setup-ally">
      Ally form (region, client ID, token, toggle, remember, save)
    </details>
  </section>

  <!-- Models: two-column grid on desktop -->
  <section class="setup-models-section">
    <h2>Local AI Models</h2>
    <div class="setup-models-grid">
      <div class="setup-model-group">           Local Generation (2 models)
      <div class="setup-model-group">           Analysis Pipeline (4 models)
    </div>
    <div class="setup-model-group setup-model-group-full">
      Storage & Cache (storage bar, persist, cache stats)
    </div>
  </section>
</article>
```

---

## CSS Architecture (setup-tool.css)

All layout is in `setup-tool.css`. Colours are in `dark.css` and `light.css`.

| Section | Key classes | Responsive |
|---------|-----------|------------|
| Hero | `.setup-hero` (CSS Grid) | 2 columns ≥768px, 1 column below |
| Status items | `.setup-status-list`, `.setup-status-item` | Always single column |
| Credential sections | `.setup-credential-section` (details/summary) | Full width, inputs stack at <480px |
| Model grid | `.setup-models-grid` (CSS Grid) | 2 columns ≥768px, 1 column below |
| Model groups | `.setup-model-group` (bordered boxes) | Fills grid cell |
| Storage & Cache | `.setup-model-group-full` | Always full width |

**Model card CSS** uses `.imgdesc-mm-*` class names (kept identical to Image Describer) so the existing styles in `image-describer.css` apply automatically with zero duplication.

**Status badge colours** use three CSS classes: `.setup-status-configured`, `.setup-status-partial`, `.setup-status-not-configured`. These are themed in `dark.css` and `light.css`.

---

## JavaScript Module (setup-tool.js)

### Pattern

IIFE with window globals. Exposes `window.SetUpTool` with two public methods.

### Public API

| Method | Purpose |
|--------|---------|
| `SetUpTool.init()` | Cache elements, load all credentials, bind events, refresh status |
| `SetUpTool.refresh()` | Reload all credential forms and update status summary |

### Global Onclick Handlers

These are exposed on `window` for inline HTML button `onclick` attributes:

| Handler | Action |
|---------|--------|
| `setupSaveOpenRouter()` | Save OpenRouter key to localStorage |
| `setupClearOpenRouter()` | Clear with confirmation dialog |
| `setupToggleOpenRouter()` | Toggle password/text visibility |
| `setupSaveMathPix()` | Save MathPix App ID + Key |
| `setupClearMathPix()` | Clear with confirmation |
| `setupToggleMathPix()` | Toggle App Key visibility |
| `setupSaveAlly()` | Save Ally region, client ID, token |
| `setupToggleAlly()` | Toggle token visibility |

### Event Listeners

| Event | Source | Action |
|-------|--------|--------|
| `credentials:changed` | Any tool saving/clearing credentials | Refresh status summary + reload the affected service's form |
| `model:stateChange` | Model Manager business logic | Update model count in status summary |

### Ally Special Behaviour

Ally has a **Remember credentials** checkbox. When unchecked and saved, all four Ally localStorage keys are **deleted** (not just emptied). This mirrors the Ally Reporting tool's existing behaviour. There is no separate Clear button for Ally — unchecking Remember + Save is the clear mechanism.

### Initialisation

Auto-initialises on `DOMContentLoaded` (or immediately if DOM is already ready). The module loads after `openrouter-embed-events.js` in the script order so `EmbedEventEmitter` is available.

---

## Element ID Conventions

### Credential Elements

| Pattern | Example |
|---------|---------|
| `setup-or-*` | `setup-or-api-key`, `setup-or-toggle-btn`, `setup-or-status-badge` |
| `setup-mp-*` | `setup-mp-app-id`, `setup-mp-app-key`, `setup-mp-toggle-btn` |
| `setup-ally-*` | `setup-ally-region`, `setup-ally-client-id`, `setup-ally-token` |
| `setup-summary-*` | `setup-summary-or-value`, `setup-summary-models-value` |

### Model Elements (Set Up copy)

| Pattern | Example |
|---------|---------|
| `setup-mm-model-{key}` | `setup-mm-model-clip`, `setup-mm-model-fastvlm` |
| `setup-mm-*` | `setup-mm-storage-bar`, `setup-mm-cache-stats`, `setup-mm-persist-btn` |

The Image Describer copy uses `imgdesc-mm-*` for the same elements. Both sets are always in the DOM. The UI module finds both via `getModelElements()`.

---

## How to Maintain

### Adding a New API Credential Service

1. **`tools.html`** — add a new `<details class="setup-credential-section">` inside `.setup-credentials-section` with the form fields. **Apply the browser-autofill hardening on every credential input** (see "Browser autofill defence" below): `autocomplete="new-password"`, `spellcheck="false"`, `data-form-type="other"`, and a unique non-standard `name` attribute (e.g. `<service>_credential_<field>_setup`). Do not use `autocomplete="off"` — Chrome ignores it on password fields and will cross-fill with another service's saved password.
2. **`setup-tool.js`** — add the new element IDs to `cacheElements()`, write `loadXxx()`, `saveXxx()`, `clearXxx()`, `toggleXxx()`, and `updateXxxStatus()` functions following the existing pattern, add global onclick handlers, call load from `init()` and `refresh()`
3. **`setup-tool.js`** — add a status check in `refreshStatusSummary()`
4. **`tools.html`** — add a status row to the `.setup-status-list` in the hero
5. **`tools.html`** — add a "Manage all API credentials in Set Up" link in the new tool's own config section. The legacy config form's inputs also need the same autofill hardening as step 1.
6. **The tool's own JS** — add a `credentials:changed` listener (guarded with `if (window.EmbedEventEmitter)`) and emit on save/clear
7. **`setup-tool.css`** — no changes needed if using existing classes

### Browser autofill defence

All credential inputs across both Set Up and the legacy per-tool config forms use a four-attribute hardening pattern, applied uniformly to prevent Chrome's password-manager heuristic from cross-filling one service's key into another service's input:

| Attribute | Value | Why |
|-----------|-------|-----|
| `autocomplete` | `"new-password"` | "This is credential-setting, not login" — Chrome respects this on password fields; it ignores `"off"`. |
| `spellcheck` | `"false"` | Stops red-squiggle on API keys. |
| `data-form-type` | `"other"` | Documented Chrome heuristic hint that this is not a login form. |
| `name` | unique per-input, namespaced (`<service>_credential_<field>_<form>`) | Prevents Chrome's heuristic from grouping sibling password inputs into one credential set. Currently-unique names: `mathpix_credential_app_{id,key}_{legacy,setup}`, `openrouter_credential_api_key_{legacy,setup}`, `ally_credential_{client_id,api_token}_{legacy,setup}`. |

When adding a new credential input, pick a fresh `<service>_credential_<field>_<form>` name. Re-using an existing name across two inputs defeats the defence.

In addition to the attribute hardening, [autofill-defence.js](../../autofill-defence.js) (loaded near the top of `tools.html` before `setup-tool.js`) applies a `readonly`-until-focus mask to every input matched by the `^<service>_credential_` name prefix. The mask blocks Chrome's "Save password?" / "Update password?" prompts that would otherwise fire when a mode controller's `loadStoredConfig()` populates the field programmatically. The mask is lifted on first focus so user-typed edits still work normally. The `readonly` attribute is set idempotently (via `data-autofill-defence-applied`), so the script is safe to re-run.

**New credential input checklist (full):**

1. Use the four-attribute hardening table above.
2. Use a unique `<service>_credential_<field>_<form>` `name` — the autofill-defence script picks up new inputs automatically by this name prefix; no edit to the defence script is needed.

### Adding a New Local AI Model

No Set Up changes needed. Add the model to `MODEL_REGISTRY` in `image-describer-model-manager.js`. The dual-UI automatically picks it up because `refreshAllModels()` iterates the full registry. Add the HTML model item in **both** `tools.html` locations (Set Up with `setup-mm-model-{key}` ID and Image Describer with `imgdesc-mm-model-{key}` ID).

### Changing the Default Landing Tool

The Set Up radio button in `tools.html` has the `checked` attribute. To change the default, move `checked` to a different radio button. The `initializeToolVisibility()` function reads whichever radio is checked and switches to that tool.

### Modifying Status Summary Styling

Status badges use three CSS classes defined in `dark.css` and `light.css`:
- `.setup-status-configured` — green-toned (service is ready)
- `.setup-status-partial` — amber-toned (some models downloaded, used only for model count)
- `.setup-status-not-configured` — red-toned (service needs credentials)

### Modifying the Quick Start Content

The quick start guide is a `<dl class="setup-quick-start-list">` inside `.setup-quick-start` in the Set Up article. Each tool is a `<dt>` (name) + `<dd>` (description) pair. Edit directly in `tools.html`.

---

## Integration Points — What Must Not Break

| System | Why it matters | Risk |
|--------|---------------|------|
| `CONFIG.API_KEY` getter (`js/config.js`) | Reads `openrouter_api_key` from localStorage on every access | None — Set Up writes to the same key |
| `setCredentials()` in the regular MathPix API client (`mathpix-api-client.js`) | Credentials injected once at mode-load from localStorage; never re-read from DOM | None — Set Up writes to the same keys; `credentials:changed` triggers a re-load |
| `_buildHeaders()` in Convert API client (`mathpix-convert-api-client.js`) | **Three-tier priority: `MATHPIX_CONFIG → localStorage → DOM`** (localStorage is canonical). Also rejects DOM values matching `^sk-or-` as autofill corruption. Do not reorder DOM above localStorage — that was the root cause of a silent Chrome-autofill bug fixed by reading from localStorage first. | None — Set Up writes to the same keys |
| Ally `loadSavedCredentials()` | Reads from `ALLY_CONFIG.STORAGE_KEYS` | None — same keys |
| `window.openRouterClient` | Uses `CONFIG.API_KEY` at request time | None — lazy read |
| Ally "Remember" checkbox | Unchecking **deletes** all keys | Set Up mirrors this behaviour |
| `model:stateChange` event flow | Drives dual-UI model updates | Must not be intercepted or suppressed |
| `switchToTool()` focus management | Screen reader announcements, heading focus | Set Up is registered in TOOL_CONFIG |

---

## Accessibility

All Set Up content meets WCAG 2.2 AA:

- All interactive elements have ≥44px touch targets
- All inputs have associated `<label>` elements
- All icons use `aria-hidden="true"` with visible text alongside
- Status change regions use `aria-live="polite"`
- Progress bars have `role="progressbar"` with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, and `aria-label`
- Heading hierarchy: `<h1>Set Up` → `<h2>API Credentials` / `<h2>Local AI Models` → `<h3>` subsections
- `prefers-reduced-motion` disables all transitions and animations
- Keyboard navigation: Tab through all controls, Enter/Space to activate, arrow keys in radio group
- Colour contrast meets AA ratios in both dark and light themes
- Screen reader announces tool switch: "Switched to Set Up configuration"
- Save/clear actions announce outcomes via the accessible announce helper

---

## Debugging

### Console Commands

```javascript
// Check module loaded
typeof window.SetUpTool                              // 'object'

// Force refresh all status displays
window.SetUpTool.refresh()

// Force refresh model manager in both locations
window.ImageDescriberModelManagerUI.refreshAll()

// Check credential status
localStorage.getItem('openrouter_api_key')           // null or key string
localStorage.getItem('mathpix-app-id')               // null or ID
localStorage.getItem('ally-api-token')               // null or token

// Check model states
window.ImageDescriberModelManager.getRegisteredModels()

// Switch to Set Up programmatically
showSetUp()

// Verify dual-UI sync
['clip','florence2','depth','tesseract','fastvlm','qwen35'].forEach(k => {
  const su = document.getElementById('setup-mm-model-' + k)?.getAttribute('data-state');
  const id = document.getElementById('imgdesc-mm-model-' + k)?.getAttribute('data-state');
  console.log(k, su === id ? '✓ synced' : '✗ OUT OF SYNC', su, id);
})
```

### Enable Verbose Logging

In `setup-tool.js`, change `ENABLE_ALL_LOGGING` to `true` (inside the IIFE, near the top). This enables DEBUG-level output prefixed with `[SetUpTool]`. Similarly in `image-describer-model-manager-ui.js`, change `ENABLE_ALL_LOGGING` to `true` for `[ModelManagerUI]` prefixed output.

---

## Project History

| Phase | Date | What |
|-------|------|------|
| SU-1 | 31 Mar 2026 | Shell, nav, OpenRouter credentials, two-column hero, CSS, event pattern |
| SU-2 | 31 Mar 2026 | MathPix + Ally credentials, status summary panel |
| SU-3 | 31 Mar 2026 | Bidirectional sync, first-time UX, "Configure in Set Up" links |
| SU-4a | 31 Mar–1 Apr 2026 | Dual-UI Model Manager: HTML, JS, CSS, init wiring, status summary count |
| SU-4b | 1 Apr 2026 | Action verification, Florence-2/selector removal, theme/a11y checks |
| SU-5 | 1 Apr 2026 | Model layout grid, default page, quick start content, WCAG audit, responsive |

Full details are in `setup-tool-bible-v1.md` (v1.6.0).
