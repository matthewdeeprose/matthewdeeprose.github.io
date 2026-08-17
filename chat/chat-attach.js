/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHAT ATTACH — Unified Chat attachments (typed: image + PDF)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Owns the ONE in-memory selected attachment for the Unified Chat tool:
 * the picked File plus its base64 bytes, held only until the turn is sent (chat-
 * core.js clears it after pushing the turn). The session NEVER stores the bytes —
 * persistence (chat-persistence.js) serialises the byte-free reference from
 * buildReference() instead.
 *
 * Drives window.ChatState ONLY (announcements, element-id prefix). It never
 * touches any window.LocalChat* global. Loads AFTER chat/chat.js so
 * window.ChatState, window.Chat and the element-id prefix exist.
 *
 * Public API (window.ChatAttach):
 *   hasAttachment()            → boolean
 *   getAttachmentPart()        → image: { type:"image_url", image_url:{ url:"data:…" } }
 *                                pdf:   { type:"file", file:{ filename, file_data:"data:…" } } | null
 *   buildReference()           → { kind:"image"|"pdf", filename, mimeType, size } | null  (byte-free)
 *   clearAttachment()          → void   (also resets the file input + preview)
 *   modelAcceptsImages(id)     → boolean (generic vision-capability gate — see below)
 *   modelAcceptsPDF(id)        → boolean (pdf token AND an "azure-openai/" OR "azure-responses/" id — see below)
 *   init()                     → void   (idempotent; wires the file input, drop target + paste)
 *
 * modelAcceptsImages is the SINGLE image-capability gate shared with the wire:
 * it resolves the unified entry via window.Chat.getModelEntry, then tests it for a
 * vision token through the selector's own checker
 * (window.EmbedModelSelector._modelHasCapabilities(entry, ["vision"])). There is
 * NO per-model and NO per-surface special-case — local models return false purely
 * through the absence of the token (they map to capabilities ["text"]), and every
 * vision-tokened model on every surface (OpenRouter, azure-openai, azure-responses
 * Codex/pro) returns true. See chat/attachments-checkpoint1-grounding-note.md.
 *
 * Architecture: IIFE with a window global. No NPM — loaded via a <script> tag.
 * ═══════════════════════════════════════════════════════════════════════════
 */

window.ChatAttach = (function () {
  "use strict";

  // ── Logging (own sink; British spelling) ──────────────────────────────────
  const LOG_LEVELS = { ERROR: 0, WARN: 1, INFO: 2, DEBUG: 3 };
  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) console.error("[ChatAttach]", message, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) console.warn("[ChatAttach]", message, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) console.log("[ChatAttach]", message, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) console.log("[ChatAttach]", message, ...args);
  }

  // ── State ──────────────────────────────────────────────────────────────────
  // The one selected attachment, or null. Shape:
  //   { file:File, base64:string, filename:string, mimeType:string, size:number,
  //     kind:"image"|"pdf" }
  let attachment = null;
  let _fileUtils = null; // lazily-constructed EmbedFileUtils instance
  let _wired = false; // idempotency guard for the input change listener
  let _dropWired = false; // idempotency guard for the drag-and-drop wiring
  let _dropCleanup = null; // teardown handle for the drop listeners (or null)
  let _pasteWired = false; // idempotency guard for the clipboard-paste wiring
  let _pasteCleanup = null; // teardown handle from bindClipboardPaste (or null)
  let _clickWired = false; // idempotency guard for the whole-box click-to-pick
  let _clickCleanup = null; // teardown handle for the box click listener (or null)

  // ── Helpers ─────────────────────────────────────────────────────────────────
  // Human-readable file size for the attachment chip (bytes → KB or MB).
  function formatFileSize(bytes) {
    if (typeof bytes !== "number" || bytes <= 0) return "";
    const kb = bytes / 1024;
    if (kb < 1024) return Math.round(kb) + " KB";
    return (kb / 1024).toFixed(1) + " MB";
  }

  function state() {
    return window.ChatState || null;
  }

  function announce(text) {
    const s = state();
    if (s && typeof s.announceToScreenReader === "function") {
      s.announceToScreenReader(text);
    }
  }

  function elId(suffix) {
    const s = state();
    return s && typeof s.elId === "function" ? s.elId(suffix) : "chat-" + suffix;
  }

  function inputEl() {
    return document.getElementById(elId("attach-input"));
  }

  function previewEl() {
    return document.getElementById(elId("attachment-preview"));
  }

  function dropzoneEl() {
    return document.getElementById(elId("attach-dropzone"));
  }

  function fileUtils() {
    if (!_fileUtils && typeof window.EmbedFileUtils === "function") {
      _fileUtils = new window.EmbedFileUtils();
    }
    return _fileUtils;
  }

  // Ask chat.js to re-evaluate the blocked-attachment notice + send gate (Stage 6).
  // Guarded — a load-order gap or a chat.js without the hook is a silent no-op.
  function refreshBlockedNotice() {
    if (window.Chat && typeof window.Chat.updateAttachmentNotice === "function") {
      window.Chat.updateAttachmentNotice();
    }
  }

  // ── Public: capability gate (shared with the wire) ──────────────────────────
  function modelAcceptsImages(modelId) {
    if (!modelId) return false;
    const Chat = window.Chat;
    const selector = window.EmbedModelSelector;
    if (!Chat || typeof Chat.getModelEntry !== "function") {
      logWarn("modelAcceptsImages: window.Chat.getModelEntry unavailable");
      return false;
    }
    if (!selector || typeof selector._modelHasCapabilities !== "function") {
      logWarn("modelAcceptsImages: EmbedModelSelector._modelHasCapabilities unavailable");
      return false;
    }
    const entry = Chat.getModelEntry(modelId);
    if (!entry) return false;
    return selector._modelHasCapabilities(entry, ["vision"]);
  }

  // The PDF-capability gate. Unlike the generic vision gate, it reads TWO facts:
  // the entry carries a `pdf` capability token AND its id begins "azure-openai/"
  // OR "azure-responses/". The gate now admits BOTH Azure surfaces — the chat
  // surface and the Responses surface (its input_file remap is live and proven).
  // The token still excludes OpenRouter (no pdf token) and local (no token);
  // gpt-4o stays out despite its azure-openai/ prefix because Stage 1 removed its
  // token (transmits but reads blind). Same window.Chat / selector availability
  // guarding and null/missing handling as modelAcceptsImages.
  function modelAcceptsPDF(modelId) {
    if (!modelId) return false;
    const Chat = window.Chat;
    const selector = window.EmbedModelSelector;
    if (!Chat || typeof Chat.getModelEntry !== "function") {
      logWarn("modelAcceptsPDF: window.Chat.getModelEntry unavailable");
      return false;
    }
    if (!selector || typeof selector._modelHasCapabilities !== "function") {
      logWarn("modelAcceptsPDF: EmbedModelSelector._modelHasCapabilities unavailable");
      return false;
    }
    const entry = Chat.getModelEntry(modelId);
    if (!entry) return false;
    return (
      selector._modelHasCapabilities(entry, ["pdf"]) &&
      (modelId.startsWith("azure-openai/") ||
        modelId.startsWith("azure-responses/"))
    );
  }

  // ── Public: attachment accessors ────────────────────────────────────────────
  function hasAttachment() {
    return attachment !== null;
  }

  function getAttachmentPart() {
    if (!attachment) return null;
    if (attachment.kind === "pdf") {
      // Same shape preparePDFContent builds — produced inline (no call into it).
      return {
        type: "file",
        file: {
          filename: attachment.filename,
          file_data:
            "data:" + attachment.mimeType + ";base64," + attachment.base64,
        },
      };
    }
    return {
      type: "image_url",
      image_url: {
        url: "data:" + attachment.mimeType + ";base64," + attachment.base64,
      },
    };
  }

  function buildReference() {
    if (!attachment) return null;
    // Byte-free either way: filename / type / size only, kind echoed from the
    // held attachment. Persistence and the restore chip read this — NEVER the
    // base64.
    return {
      kind: attachment.kind === "pdf" ? "pdf" : "image",
      filename: attachment.filename,
      mimeType: attachment.mimeType,
      size: attachment.size,
    };
  }

  function clearAttachment() {
    const had = attachment !== null;
    const clearedKind = attachment ? attachment.kind : null;
    attachment = null;
    renderPreview();
    const input = inputEl();
    if (input) input.value = ""; // so re-picking the SAME file still fires change
    if (had) {
      announce(
        clearedKind === "pdf"
          ? "PDF attachment removed."
          : "Image attachment removed."
      );
    }
    refreshBlockedNotice(); // removing an attachment clears any blocked-model gate
    logDebug("Attachment cleared", { had });
  }

  // ── Selection flow ──────────────────────────────────────────────────────────
  async function setFromFile(file) {
    const utils = fileUtils();
    if (!utils) {
      logError("EmbedFileUtils unavailable — cannot build the attachment");
      announce("Could not attach the image: the file utility is unavailable.");
      return;
    }

    // Type gate (throws on unsupported type / non-File). EmbedFileUtils is
    // already PDF-aware — the returned { isImage, isPDF } tells us the kind, so
    // there is no separate validator and no size branch here (both below are
    // kind-correct already).
    let kind;
    try {
      const { isImage, isPDF } = utils.validateFileType(file);
      kind = isPDF ? "pdf" : "image";
      logDebug("Attachment type accepted", { isImage, isPDF, kind });
    } catch (e) {
      logWarn("Rejected attachment (type)", e && e.message);
      announce(
        "That file type is not supported. Attach a JPEG, PNG, WebP image or a PDF."
      );
      const input = inputEl();
      if (input) input.value = "";
      return;
    }

    // Size gate (throws over the image limit — keeps the 10MB hint honest).
    try {
      utils.validateFileSize(file);
    } catch (e) {
      logWarn("Rejected attachment (size)", e && e.message);
      announce((e && e.message) || "That image is too large.");
      const input = inputEl();
      if (input) input.value = "";
      return;
    }

    // Bytes. Compression is left to the embed default at send time.
    let base64;
    try {
      base64 = await utils.fileToBase64(file);
    } catch (e) {
      logError("fileToBase64 failed", e && e.message);
      announce("Could not read the image. Try again or choose another file.");
      const input = inputEl();
      if (input) input.value = "";
      return;
    }

    // A clipboard-pasted file can arrive with a blank or generic name; fall back
    // to a readable label (by kind) so the preview text and the spoken cue never
    // read oddly (e.g. an empty filename or "Image attached: ."). A blank name on
    // a PDF is unlikely, but "Pasted document" keeps it honest. Input- and drop-
    // picked files always carry a name, so this is a no-op for those paths.
    const fallbackName = kind === "pdf" ? "Pasted document" : "Pasted image";
    const displayName =
      file.name && file.name.trim() ? file.name : fallbackName;

    attachment = {
      file: file,
      base64: base64,
      filename: displayName,
      mimeType: file.type,
      size: file.size,
      kind: kind,
    };
    renderPreview();
    announce(
      (kind === "pdf" ? "PDF attached: " : "Image attached: ") + displayName + "."
    );
    refreshBlockedNotice(); // attaching to an incapable model shows the gate now
    logInfo("Attachment set", { filename: file.name, size: file.size, type: file.type, kind: kind });
  }

  // ── Pre-send preview chip (in #chat-attachment-preview) ─────────────────────
  function renderPreview() {
    const host = previewEl();
    if (!host) return;
    host.textContent = ""; // clear
    if (!attachment) return;

    const chip = document.createElement("div");
    chip.className = "chat-attachment-chip";
    chip.style.display = "inline-flex";
    chip.style.alignItems = "center";
    chip.style.gap = "0.5em";

    // Leading visual: an image gets its data-URL thumbnail; a PDF gets a
    // decorative document icon of roughly matching visual weight (the filename
    // carries the meaning). The filename span + Remove control below are shared.
    if (attachment.kind === "image") {
      const thumb = document.createElement("img");
      thumb.className = "chat-attachment-thumb";
      thumb.src = "data:" + attachment.mimeType + ";base64," + attachment.base64;
      thumb.alt = ""; // decorative — the filename is shown as visible text below
      thumb.style.height = "2.5rem";
      thumb.style.width = "auto";
      thumb.style.borderRadius = "4px";
      chip.appendChild(thumb);
    } else if (attachment.kind === "pdf") {
      const docIcon = document.createElement("span");
      docIcon.className = "chat-attachment-doc-icon";
      docIcon.setAttribute("aria-hidden", "true"); // decorative — filename names it
      docIcon.setAttribute("data-icon", "pdf");
      docIcon.style.display = "inline-flex";
      docIcon.style.fontSize = "2rem"; // ≈ the thumbnail's visual weight
      chip.appendChild(docIcon);
    }

    const name = document.createElement("span");
    name.className = "chat-attachment-filename";
    name.textContent = attachment.filename; // textContent — never innerHTML (safe)
    chip.appendChild(name);

    // PDF-only: the formatted file size after the filename. Omitted (not shown
    // empty) when the size is unknown / zero.
    if (attachment.kind === "pdf") {
      const sizeText = formatFileSize(attachment.size);
      if (sizeText) {
        const sizeSpan = document.createElement("span");
        sizeSpan.className = "chat-attachment-size";
        sizeSpan.textContent = sizeText;
        chip.appendChild(sizeSpan);
      }
    }

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "chat-attachment-remove";
    // Adequate target size (SC 2.5.8) — set inline as this is dynamic markup.
    remove.style.display = "inline-flex";
    remove.style.alignItems = "center";
    remove.style.gap = "0.35em";
    remove.style.minHeight = "44px";
    remove.style.cursor = "pointer";
    const icon = document.createElement("span");
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("data-icon", "close");
    remove.appendChild(icon);
    remove.appendChild(
      document.createTextNode(
        attachment.kind === "pdf" ? "Remove PDF" : "Remove image"
      )
    );
    remove.addEventListener("click", function () {
      clearAttachment();
      const input = inputEl();
      if (input && typeof input.focus === "function") input.focus();
    });
    chip.appendChild(remove);

    host.appendChild(chip);

    // Dynamically-inserted data-icon spans are not auto-populated — do it now.
    if (window.IconLibrary && typeof window.IconLibrary.populateIcons === "function") {
      window.IconLibrary.populateIcons(chip);
    } else if (typeof window.refreshIcons === "function") {
      window.refreshIcons(chip);
    }

    // The library SVGs ship fixed 21px width/height attributes; a CSS width/height
    // on the element overrides them, so scale the PDF document icon up to ≈2rem to
    // match the image thumbnail's visual weight. Decorative — no-op for the image
    // chip (which has no doc icon) and harmless if population found no SVG.
    const docSvg = chip.querySelector(".chat-attachment-doc-icon svg");
    if (docSvg) {
      docSvg.style.width = "2rem";
      docSvg.style.height = "2rem";
    }
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────
  // Drag-and-drop is an ENHANCEMENT over the native file input, never a
  // replacement: the label-wrapped input stays the primary keyboard-operable
  // control. The drop path terminates in the SAME setFromFile() the input's
  // change listener uses, so type/size validation, renderPreview(), the "Image
  // attached." announcement and the blocked-notice refresh are all inherited —
  // nothing is duplicated here.
  function wireDrop() {
    if (_dropWired) return; // the drop target is bound once
    const zone = dropzoneEl();
    if (!zone) {
      logDebug("wireDrop: drop target not found yet");
      return;
    }
    const DRAG_CLASS = "drag-over"; // the Stage 2 shape-change state class

    const onDragOver = function (e) {
      e.preventDefault(); // required so the browser will fire "drop"
      e.stopPropagation();
      zone.classList.add(DRAG_CLASS);
    };
    const onDragLeave = function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove(DRAG_CLASS);
    };
    const onDrop = function (e) {
      e.preventDefault();
      e.stopPropagation();
      zone.classList.remove(DRAG_CLASS);
      // First file only. setFromFile owns validation and all user feedback.
      const file =
        e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      if (file) setFromFile(file);
    };

    zone.addEventListener("dragover", onDragOver);
    zone.addEventListener("dragleave", onDragLeave);
    zone.addEventListener("drop", onDrop);

    // Teardown handle (symmetry with the Stage 4 paste cleanup): removes the
    // listeners and clears any lingering drag-over state so re-wiring is clean.
    _dropCleanup = function () {
      zone.removeEventListener("dragover", onDragOver);
      zone.removeEventListener("dragleave", onDragLeave);
      zone.removeEventListener("drop", onDrop);
      zone.classList.remove(DRAG_CLASS);
      _dropWired = false;
      _dropCleanup = null;
      logDebug("drop wiring torn down");
    };

    _dropWired = true;
    logInfo("wireDrop complete (dragover/dragleave/drop on #" + zone.id + ")");
  }

  // Clipboard paste is a second ENHANCEMENT over the file input, delegated to the
  // shared EmbedFileUtils.bindClipboardPaste helper. Scoped to #chat-app with
  // preventInInputs:true, so a normal text paste in the composer textarea is NEVER
  // hijacked — an image only attaches when focus is within the Chat tool but not
  // in a text field. onPaste terminates in the SAME setFromFile() the input and
  // drop use (size re-validated there); the helper type-filters before onPaste,
  // so a wrong-type paste is reported via onError instead.
  function wirePaste() {
    if (_pasteWired) return; // bound once
    const utils = fileUtils();
    if (!utils || typeof utils.bindClipboardPaste !== "function") {
      logDebug("wirePaste: EmbedFileUtils.bindClipboardPaste unavailable");
      return;
    }
    if (!document.querySelector("#chat-app")) {
      logDebug("wirePaste: #chat-app not found yet");
      return;
    }
    try {
      _pasteCleanup = utils.bindClipboardPaste({
        containerSelector: "#chat-app",
        acceptedTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
        preventInInputs: true,
        onPaste: function (file) {
          setFromFile(file); // SAME entry as the input + drop paths
        },
        onError: function (err) {
          // The helper filters wrong types before setFromFile sees them, so it
          // owns this rejection cue; mirror setFromFile's type-rejection wording.
          logWarn("Rejected paste (type)", err && err.message);
          announce(
            "That file type is not supported. Paste a JPEG, PNG, WebP image or a PDF."
          );
        },
      });
      _pasteWired = true;
      logInfo("wirePaste complete (clipboard paste bound to #chat-app)");
    } catch (e) {
      logError("wirePaste failed", e && e.message);
    }
  }

  // Whole-box click-to-pick: clicking anywhere in the drop target opens the file
  // picker, so the click area matches the visible dashed box rather than just the
  // label text. Pointer-only — it adds NO role/tabindex/keydown, so the native
  // label stays the sole keyboard control (keyboard users Tab to the input and
  // press Space/Enter). Clicks on the label itself are ignored (the label already
  // opens the picker natively — this avoids a double-open), as are clicks on any
  // interactive child such as the preview's Remove button.
  function wireClickToPick() {
    if (_clickWired) return; // bound once
    const zone = dropzoneEl();
    if (!zone) {
      logDebug("wireClickToPick: drop target not found yet");
      return;
    }
    const onClick = function (e) {
      if (
        e.target.closest("label, button, a, input, select, textarea")
      ) {
        return; // native/interactive target owns this click
      }
      const input = inputEl();
      if (input) input.click();
    };
    zone.addEventListener("click", onClick);
    _clickCleanup = function () {
      zone.removeEventListener("click", onClick);
      _clickWired = false;
      _clickCleanup = null;
    };
    _clickWired = true;
    logInfo("wireClickToPick complete (box click opens the picker)");
  }

  function init() {
    // File input (the primary keyboard-operable control) — bound once.
    if (!_wired) {
      const input = inputEl();
      if (input) {
        input.addEventListener("change", function () {
          const file = input.files && input.files[0];
          if (file) setFromFile(file);
        });
        _wired = true;
        logInfo("init complete (file input wired)");
      } else {
        logDebug("init: file input not found yet");
      }
    }
    // Drag-and-drop enhancement — bound once, independently of the input.
    wireDrop();
    // Clipboard-paste enhancement — bound once, independently of the input.
    wirePaste();
    // Whole-box click-to-pick enhancement — bound once, independently.
    wireClickToPick();
  }

  // Self-initialise once the DOM is ready (the input is static markup in tools.html).
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  return {
    hasAttachment: hasAttachment,
    getAttachmentPart: getAttachmentPart,
    buildReference: buildReference,
    clearAttachment: clearAttachment,
    modelAcceptsImages: modelAcceptsImages,
    modelAcceptsPDF: modelAcceptsPDF,
    init: init,
    // Inspection / teardown handles (never production entry points).
    _setFromFile: setFromFile,
    _wireDrop: wireDrop,
    _teardownDrop: function () {
      return _dropCleanup ? _dropCleanup() : undefined;
    },
    _wirePaste: wirePaste,
    _teardownPaste: function () {
      if (_pasteCleanup) {
        _pasteCleanup();
        _pasteCleanup = null;
        _pasteWired = false;
      }
    },
    _wireClickToPick: wireClickToPick,
    _teardownClickToPick: function () {
      return _clickCleanup ? _clickCleanup() : undefined;
    },
  };
})();
