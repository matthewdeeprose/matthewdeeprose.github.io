/**
 * Universal Modal System - Complete Edition with Backward Compatibility
 * Drop-in replacement for broken modal system
 *
 * Maintains full API compatibility with existing code while using
 * the new robust implementation under the hood.
 *
 * @version 2.1.0 - Added backward compatibility layer
 */

const UniversalModal = (function () {
  "use strict";

  // Logging configuration
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[UniversalModal ERROR]: ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[UniversalModal WARN]: ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[UniversalModal INFO]: ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[UniversalModal DEBUG]: ${message}`, ...args);
  }

  // ====== NEW ROBUST MODAL MANAGER (from working system) ======
  class ModalManager {
    constructor() {
      this.activeModals = new Map();
      this.modalCounter = 0;
      this.originalFocus = null;
      this.isInitialised = false;
      this.hasActiveModal = false;
      this.activeModalElement = null;

      // Background scroll prevention properties
      this.originalBodyOverflow = null;
      this.originalBodyPosition = null;
      this.originalBodyTop = null;
      this.originalBodyWidth = null;
      this.originalScrollPosition = null;
      this.isScrollPrevented = false;

      // Status positioning properties
      this.statusPositionHandlers = new Map();

      // Background-close handlers, keyed by modalId. Separate from
      // activeModals so that entry's shape is untouched, and modelled on
      // statusPositionHandlers above: populated at registration, drained at
      // close. Only modals with background close enabled ever appear here.
      this.backgroundCloseHandlers = new Map();

      // The elements each modal's own sweep made inert, keyed by modalId.
      // Live element references, never ids — several swept elements (the
      // toggletip live region among them) have no id. Modelled on the two Maps
      // above: populated at open, drained at close. An entry is always written,
      // even when the sweep added nothing, because its presence is what records
      // that this modal is still open.
      this.modalInertElements = new Map();
      this.resizeObserver = null;
      this.intersectionObserver = null;
    }

    initialise() {
      if (this.isInitialised) return;
      this.setupGlobalEventListeners();
      this.setupObservers();
      this.isInitialised = true;
      logInfo("Modal system initialised with enhanced status positioning");
    }

    setupObservers() {
      if (window.ResizeObserver) {
        this.resizeObserver = new ResizeObserver((entries) => {
          if (this.hasActiveModal) {
            this.updateAllStatusPositions();
          }
        });
      }
    }

    setupGlobalEventListeners() {
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && this.hasActiveModal) {
          e.preventDefault();
          const latestModal = Array.from(this.activeModals.values()).pop();
          if (
            latestModal &&
            latestModal.options.allowBackgroundClose !== false
          ) {
            this.close(latestModal.id, "escape");
          }
        }
      });
    }

    preventBackgroundScroll() {
      if (this.isScrollPrevented) return;

      logDebug("Preventing background scroll");

      this.originalScrollPosition =
        window.pageYOffset || document.documentElement.scrollTop;
      this.originalBodyOverflow = document.body.style.overflow;
      this.originalBodyPosition = document.body.style.position;
      this.originalBodyTop = document.body.style.top;
      this.originalBodyWidth = document.body.style.width;

      document.body.style.overflow = "hidden";
      document.body.style.position = "fixed";
      document.body.style.top = `-${this.originalScrollPosition}px`;
      document.body.style.width = "100%";

      this.isScrollPrevented = true;
      logDebug(
        `Scroll prevented at position: ${this.originalScrollPosition}px`,
      );
    }

    restoreBackgroundScroll() {
      if (!this.isScrollPrevented) return;

      logDebug("Restoring background scroll");

      document.body.style.overflow = this.originalBodyOverflow || "";
      document.body.style.position = this.originalBodyPosition || "";
      document.body.style.top = this.originalBodyTop || "";
      document.body.style.width = this.originalBodyWidth || "";

      if (this.originalScrollPosition !== null) {
        // Restore the pre-open scroll position instantly. The global
        // html { scroll-behavior: smooth } rule would otherwise animate this
        // jump over ~400ms on every modal close; "instant" defeats that for
        // this one call, matching the established pattern used elsewhere in the
        // repo. Reduced-motion users are already served by the global
        // scroll-behavior: auto override, so no separate guard is needed here.
        window.scrollTo({ top: this.originalScrollPosition, left: 0, behavior: "instant" });
      }

      this.originalBodyOverflow = null;
      this.originalBodyPosition = null;
      this.originalBodyTop = null;
      this.originalBodyWidth = null;
      this.originalScrollPosition = null;
      this.isScrollPrevented = false;

      logDebug("Background scroll restored");
    }

    isScrollableViewport(modal) {
      if (!modal) return false;

      const container = modal.querySelector(".universal-modal-container");
      if (!container) return false;

      const hasVerticalScroll = container.scrollHeight > container.clientHeight;
      const containerStyle = window.getComputedStyle(container);
      const isScrollable =
        containerStyle.overflowY === "auto" ||
        containerStyle.overflowY === "scroll";

      return hasVerticalScroll && isScrollable;
    }

    calculateStatusPosition(modal, statusElement) {
      if (!modal || !statusElement) return null;

      const container = modal.querySelector(".universal-modal-container");
      if (!container) return null;

      const containerRect = container.getBoundingClientRect();
      const statusHeight = statusElement.offsetHeight || 48;

      return {
        left: containerRect.left,
        right: window.innerWidth - containerRect.right,
        bottom: window.innerHeight - containerRect.bottom,
        width: containerRect.width,
      };
    }

    updateStatusPosition(modalId) {
      const statusElement = document.getElementById(`${modalId}-status`);
      if (!statusElement) return;

      const modal = statusElement.closest(".universal-modal");
      if (!modal) return;

      const isScrollable = this.isScrollableViewport(modal);

      if (isScrollable) {
        statusElement.classList.remove("normal-viewport");
        statusElement.classList.add("scrollable-viewport");

        const position = this.calculateStatusPosition(modal, statusElement);
        if (position) {
          statusElement.style.position = "fixed";
          statusElement.style.left = `${position.left}px`;
          statusElement.style.right = `${position.right}px`;
          statusElement.style.bottom = `${position.bottom}px`;
          statusElement.style.width = `${position.width}px`;
          statusElement.style.maxWidth = "none";
          statusElement.style.margin = "0";

          logDebug(
            `Status position updated for scrollable viewport: ${modalId}`,
            position,
          );
        }
      } else {
        statusElement.classList.remove("scrollable-viewport");
        statusElement.classList.add("normal-viewport");
        statusElement.style.position = "";
        statusElement.style.left = "";
        statusElement.style.right = "";
        statusElement.style.bottom = "";
        statusElement.style.width = "";
        statusElement.style.maxWidth = "";
        statusElement.style.margin = "";

        logDebug(`Status position reset for normal viewport: ${modalId}`);
      }
    }

    updateAllStatusPositions() {
      this.activeModals.forEach((modalData, modalId) => {
        this.updateStatusPosition(modalId);
      });
    }

    setupStatusPositionHandlers(modal, modalId) {
      if (!modal) return;

      const container = modal.querySelector(".universal-modal-container");
      if (!container) return;

      let scrollTimeout = null;
      const scrollHandler = () => {
        if (scrollTimeout) clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          this.updateStatusPosition(modalId);
        }, 16);
      };

      const resizeHandler = () => {
        this.updateStatusPosition(modalId);
      };

      this.statusPositionHandlers.set(modalId, {
        scrollHandler,
        resizeHandler,
        container,
      });

      container.addEventListener("scroll", scrollHandler, { passive: true });
      window.addEventListener("resize", resizeHandler, { passive: true });

      if (this.resizeObserver) {
        this.resizeObserver.observe(container);
      }

      logDebug(`Status position handlers setup for modal: ${modalId}`);
    }

    cleanupStatusPositionHandlers(modalId) {
      const handlers = this.statusPositionHandlers.get(modalId);
      if (!handlers) return;

      const { scrollHandler, resizeHandler, container } = handlers;

      if (container) {
        container.removeEventListener("scroll", scrollHandler);
      }
      window.removeEventListener("resize", resizeHandler);

      if (this.resizeObserver && container) {
        this.resizeObserver.unobserve(container);
      }

      this.statusPositionHandlers.delete(modalId);
      logDebug(`Status position handlers cleaned up for modal: ${modalId}`);
    }

    /**
     * Remove this modal's background-close listener from `document`.
     *
     * The flag is deliberately NOT re-evaluated here: a modal that never
     * registered one has no map entry, so this is a no-op for it. That keeps
     * teardown correct even if the options object a caller passed is mutated
     * between open and close.
     *
     * @param {string} modalId
     */
    cleanupBackgroundCloseHandler(modalId) {
      const handler = this.backgroundCloseHandlers.get(modalId);
      if (!handler) return;

      document.removeEventListener("click", handler);
      this.backgroundCloseHandlers.delete(modalId);
      logDebug(`Background-close handler cleaned up for modal: ${modalId}`);
    }

    show(config) {
      if (!this.isInitialised) {
        this.initialise();
      }

      return new Promise((resolve) => {
        const modalId = `universal-modal-${++this.modalCounter}`;
        const modal = this.createModal(modalId, config, resolve);

        this.activeModals.set(modalId, {
          id: modalId,
          element: modal,
          resolve,
          options: config.options || {},
          // OPT-IN focus return (20 August 2026). Per modal, unlike
          // this.originalFocus below, which is ONE field for the whole stack and
          // is therefore overwritten by any modal opened on top of this one. A
          // modal that declares returnFocusTo is immune to that; one that does
          // not is unaffected by this field's existence and keeps the legacy
          // path exactly. See docs/universal-modal-focus-return-plan.md.
          returnFocusTo: config.returnFocusTo || null,
        });

        this.hasActiveModal = true;
        this.activeModalElement = modal;
        // DELIBERATELY UNCHANGED. Undeclared modals must behave byte-identically,
        // so this assignment stays even though it is the defect's mechanism.
        this.originalFocus = document.activeElement;
        this.displayModal(modal, modalId);
      });
    }

    createModal(modalId, config, resolve) {
      const {
        title,
        content,
        type = "info",
        size = "medium",
        buttons = [],
        template,
        options = {},
      } = config;

      const templateConfig = template ? this.getTemplate(template) : {};
      const finalButtons =
        buttons.length > 0 ? buttons : templateConfig.buttons || [];
      const finalOptions = { ...templateConfig, ...options };

      const modal = document.createElement("dialog");
      modal.id = modalId;
      modal.className = `universal-modal universal-modal-${size}`;

      // Caller-supplied hook class, applied ADDITIVELY so it can never clobber
      // the structural classes above or the ones added below. Accepted by the
      // legacy Modal since it was written and silently discarded until
      // 20 August 2026; note that showAlert/showConfirm default it to
      // "universal-alert"/"universal-confirm", so wiring it means every alert
      // and confirm now carries that class. No stylesheet matches either name,
      // so the change is inert — recorded because it is app-wide.
      if (config.className) {
        String(config.className)
          .split(/\s+/)
          .filter(Boolean)
          .forEach((cls) => modal.classList.add(cls));
      }

      // Add legacy classes for backward compatibility
      modal.classList.add("accessible-modal", `modal-size-${size}`);

      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", `${modalId}-heading`);
      modal.setAttribute("role", "dialog");

      const container = document.createElement("div");
      container.className = "universal-modal-container";

      // Add legacy classes for backward compatibility
      container.classList.add("universal-modal-content", "modal-content");

      const header = this.createHeader(
        modalId,
        title,
        type,
        finalOptions.allowBackgroundClose !== false,
      );
      container.appendChild(header);

      const body = this.createBody(content, templateConfig, modalId);
      container.appendChild(body);

      if (finalButtons.length > 0) {
        const footer = this.createFooter(finalButtons, modalId, resolve);
        container.appendChild(footer);
      }

      const statusArea = this.createStatusArea(modalId);
      container.appendChild(statusArea);

      modal.appendChild(container);
      this.addModalEventListeners(modal, modalId, finalOptions, resolve);

      return modal;
    }

    createHeader(modalId, title, type, showClose) {
      const header = document.createElement("div");
      header.className = "universal-modal-header";

      // Add legacy classes for backward compatibility
      header.classList.add("modal-header");

      const typeIcons = {
        info: `<svg height="40" viewBox="0 0 21 21" width="40" xmlns="http://www.w3.org/2000/svg" role="img" class="infoModalIcon" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" transform="translate(2 2)">
            <g stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="8.5" cy="8.5" r="8"/>
              <path d="m8.5 12.5v-4h-1"/>
              <path d="m7.5 12.5h2"/>
            </g>
            <circle cx="8.5" cy="5.5" fill="currentColor" r="1"/>
          </g>
        </svg>`,
        warning: `<svg height="40" viewBox="0 0 21 21" width="40" xmlns="http://www.w3.org/2000/svg" role="img" class="warningModalIcon" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" transform="translate(1 1)">
            <path d="m9.5.5 9 16h-18z" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="m9.5 10.5v-5" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="9.5" cy="13.5" fill="currentColor" r="1"/>
          </g>
        </svg>`,
        error: `<svg height="40" viewBox="0 0 21 21" width="40" xmlns="http://www.w3.org/2000/svg" role="img" class="errorModalIcon"aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(2 2)">
            <circle cx="8.5" cy="8.5" r="8"/>
            <path d="m3 3 11 11" transform="matrix(-1 0 0 1 17 0)"/>
          </g>
        </svg>`,
        success: `<svg height="40" viewBox="0 0 21 21" width="40" xmlns="http://www.w3.org/2000/svg" role="img" class="successModalIcon" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(3 3)">
            <path d="m4.5.5h6c.5522847 0 1 .44771525 1 1v5c0 2.209139-1.790861 4-4 4s-4-1.790861-4-4v-5c0-.55228475.44771525-1 1-1z"/>
            <path d="m7.5 10.5v3"/>
            <path d="m4.5 13.5h6c.5522847 0 1 .4477153 1 1s-.4477153 1-1 1h-6c-.55228475 0-1-.4477153-1-1s.44771525-1 1-1zm7-11h2c.5522847 0 1 .44771525 1 1v1c0 1.1045695-.8954305 2-2 2h-1zm-8 0h-2c-.55228475 0-1 .44771525-1 1v1c0 1.1045695.8954305 2 2 2h1"/>
          </g>
        </svg>`,
        confirmation: `<svg height="40" viewBox="0 0 21 21" width="40" xmlns="http://www.w3.org/2000/svg" role="img" class="confirmModalIcon" aria-hidden="true">
          <g fill="none" fill-rule="evenodd" transform="translate(2 2)">
            <circle cx="8.5" cy="8.5" r="8" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="m8.5 9.5v-1l1.41421356-1.41421356c.37507274-.37507276.58578644-.88378059.58578644-1.41421356v-.17157288c0-.61286606-.3462631-1.17313156-.89442719-1.4472136l-.21114562-.1055728c-.56305498-.2815275-1.2257994-.2815275-1.78885438 0l-.10557281.0527864c-.61286606.30643303-1 .9328289-1 1.61803399v.88196601" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="8.5" cy="12.5" fill="currentColor" r="1"/>
          </g>
        </svg>`,
      };

      if (typeIcons[type]) {
        const icon = document.createElement("span");
        icon.className = "universal-modal-icon";
        icon.innerHTML = typeIcons[type];
        icon.setAttribute("aria-hidden", "true");
        header.appendChild(icon);
      }

      const heading = document.createElement("h1");
      heading.id = `${modalId}-heading`;
      heading.className = "universal-modal-heading";

      // Add legacy classes for backward compatibility
      heading.classList.add("universal-modal-title", "modal-title");

      heading.textContent = title || "Modal Dialog";
      heading.tabIndex = -1;
      header.appendChild(heading);

      if (showClose) {
        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "universal-modal-close";

        // Add legacy classes for backward compatibility
        closeBtn.classList.add("modal-close-button");

        closeBtn.setAttribute("aria-label", "Close modal dialog");
        closeBtn.innerHTML = '<span aria-hidden="true">&times;</span>';
        closeBtn.addEventListener("click", () => this.close(modalId, "close"));
        header.appendChild(closeBtn);
      }

      return header;
    }

    createBody(content, templateConfig, modalId) {
      const body = document.createElement("div");
      body.className = "universal-modal-body";

      // Add legacy classes for backward compatibility
      body.classList.add("modal-body");

      if (typeof content === "string") {
        if (content.includes("<")) {
          body.innerHTML = content;
        } else {
          body.textContent = content;
        }
      } else if (content instanceof HTMLElement) {
        body.appendChild(content);
      } else if (content) {
        body.textContent = String(content);
      }

      if (templateConfig.hasInput) {
        const input = document.createElement("input");
        input.type = "text";
        input.id = `${modalId}-input`;
        input.className = "universal-modal-input";
        input.setAttribute("aria-label", "Enter your response");
        body.appendChild(input);
      }

      return body;
    }

    createFooter(buttons, modalId, resolve) {
      const footer = document.createElement("div");
      footer.className = "universal-modal-footer";

      buttons.forEach((buttonConfig) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `universal-modal-button universal-modal-button-${
          buttonConfig.type || "secondary"
        }`;
        button.textContent = buttonConfig.text;

        button.addEventListener("click", () => {
          let result = buttonConfig.action;
          if (buttonConfig.action === "confirm") {
            const input = document.getElementById(`${modalId}-input`);
            result = input ? input.value : true;
          } else if (buttonConfig.action === "cancel") {
            result = false;
          }
          this.close(modalId, result);
        });

        footer.appendChild(button);
      });

      return footer;
    }

    createStatusArea(modalId) {
      const statusArea = document.createElement("div");
      statusArea.id = `${modalId}-status`;
      statusArea.className = "universal-modal-status normal-viewport";
      // Phase 7.3J: aria-live and role="status" moved to the text element only.
      // Previously these were on the outer container with aria-atomic="true",
      // which caused two problems:
      // 1. The dismiss button's aria-label ("Dismiss notification") was included
      //    in every announcement because aria-atomic reads the full region
      // 2. Two sequential DOM changes (text update + button visibility) each
      //    triggered a full atomic re-read, causing double announcements

      statusArea.innerHTML = `
        <span class="universal-modal-status-icon" aria-hidden="true"></span>
        <div class="universal-modal-status-text" role="status" aria-live="polite"></div>
        <div class="universal-modal-status-actions"></div>
        <button type="button" class="universal-modal-status-dismiss" aria-label="Dismiss notification" style="display: none;">
          <span aria-hidden="true">×</span>
        </button>
      `;

      const dismissBtn = statusArea.querySelector(
        ".universal-modal-status-dismiss",
      );
      dismissBtn.addEventListener("click", () => this.hideModalStatus(modalId));

      return statusArea;
    }

    showModalStatus(modalId, message, type = "info", options = {}) {
      const statusArea = document.getElementById(`${modalId}-status`);
      if (!statusArea) return;

      const modal = statusArea.closest(".universal-modal");
      const modalBody = modal
        ? modal.querySelector(".universal-modal-body")
        : null;

      const iconElement = statusArea.querySelector(
        ".universal-modal-status-icon",
      );
      const textElement = statusArea.querySelector(
        ".universal-modal-status-text",
      );
      const actionsSlot = statusArea.querySelector(
        ".universal-modal-status-actions",
      );
      const dismissBtn = statusArea.querySelector(
        ".universal-modal-status-dismiss",
      );

      const icons = {
        success: "✓",
        error: "⚠",
        warning: "⚠",
        info: "ℹ",
        loading: "",
      };

      statusArea.className = "universal-modal-status show";
      statusArea.classList.add(`status-${type}`);

      if (modalBody) {
        modalBody.classList.add("has-status");
      }

      if (message.length > 100 || message.includes("\n")) {
        statusArea.classList.add("status-long");
      }

      if (type === "loading") {
        iconElement.innerHTML =
          '<div class="universal-modal-spinner" aria-label="Loading"></div>';
      } else {
        iconElement.textContent = icons[type] || icons.info;
        iconElement.setAttribute("aria-label", `${type} icon`);
      }

      textElement.textContent = message;

      // Populate optional action buttons (cleared on every show — handler
      // closures GC'd via parent clearance).
      if (actionsSlot) {
        actionsSlot.innerHTML = "";
        if (Array.isArray(options.actions) && options.actions.length > 0) {
          options.actions.forEach((action) => {
            if (!action || typeof action.onClick !== "function") return;
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "universal-modal-status-action";
            btn.textContent = action.label || "";
            if (action.ariaLabel) {
              btn.setAttribute("aria-label", action.ariaLabel);
            }
            btn.addEventListener("click", () => {
              try {
                action.onClick();
              } catch (err) {
                logError("Status action onClick threw:", err);
              }
              if (action.dismissOnClick !== false) {
                this.hideModalStatus(modalId);
              }
            });
            actionsSlot.appendChild(btn);
          });
        }
      }

      if (options.dismissible !== false && type !== "loading") {
        dismissBtn.style.display = "block";
      } else {
        dismissBtn.style.display = "none";
      }

      requestAnimationFrame(() => {
        this.updateStatusPosition(modalId);
      });

      if (options.duration && options.duration > 0) {
        setTimeout(() => this.hideModalStatus(modalId), options.duration);
      }

      logDebug(`Modal status shown: ${type} - ${message}`);
    }

    hideModalStatus(modalId) {
      const statusArea = document.getElementById(`${modalId}-status`);
      if (!statusArea) return;

      const modal = statusArea.closest(".universal-modal");
      const modalBody = modal
        ? modal.querySelector(".universal-modal-body")
        : null;

      statusArea.classList.remove("show");

      if (modalBody) {
        modalBody.classList.remove("has-status");
      }

      setTimeout(() => {
        if (statusArea) {
          statusArea.querySelector(".universal-modal-status-text").textContent =
            "";
          statusArea.querySelector(".universal-modal-status-icon").textContent =
            "";
          const actionsSlot = statusArea.querySelector(
            ".universal-modal-status-actions",
          );
          if (actionsSlot) actionsSlot.innerHTML = "";
          statusArea.className = "universal-modal-status normal-viewport";
        }
      }, 300);

      logDebug("Modal status hidden");
    }

    updateModalStatus(modalId, message, type = "info", options = {}) {
      this.showModalStatus(modalId, message, type, options);
    }

    addModalEventListeners(modal, modalId, options, resolve) {
      // Background-close listener, attached ONLY when background close is
      // enabled. The guard is the exact expression the handler itself used to
      // test, so wherever it is false the handler could never have acted and
      // the listener was unreachable — removing it there changes no behaviour.
      //
      // Why it is worth not attaching: a screen-reader listen against this
      // repo's probe fixture (a11y-fixtures/nvda-modal-probe.html, 27 July
      // 2026) compared two dialogs identical but for this listener, and the
      // state reported for the focused element inside them differed. That is
      // the whole of what was measured; nothing here predicts what any given
      // reader or version will say.
      // It is registered on `document`, not on the dialog. A backdrop click
      // still targets the dialog element, so the handler is unchanged and the
      // stacked case still works — each open modal registers its own handler
      // and each only answers to its own element. The cost is that a listener
      // on `document` outlives the dialog, so it MUST be removed on close;
      // cleanupBackgroundCloseHandler does that from finishClose, following the
      // statusPositionHandlers pattern.
      if (options.allowBackgroundClose !== false) {
        const backgroundClickHandler = (e) => {
          // Still required. Clicks on the modal's own content bubble up to the
          // dialog element, so only a click whose target IS the dialog itself
          // is a backdrop click.
          if (e.target === modal) {
            this.close(modalId, "background");
          }
        };

        // Stored before attaching, so the handle always exists for teardown.
        this.backgroundCloseHandlers.set(modalId, backgroundClickHandler);
        document.addEventListener("click", backgroundClickHandler);
      }

      modal.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          this.trapFocus(e, modal);
        }
      });
    }

    displayModal(modal, modalId) {
      document.body.appendChild(modal);

      if (this.activeModals.size === 1) {
        this.preventBackgroundScroll();
      }

      modal.showModal();
      this.makeBackgroundInert(modalId);

      requestAnimationFrame(() => {
        this.setupStatusPositionHandlers(modal, modalId);
        this.updateStatusPosition(modalId);

        // Focus the dialog element itself rather than its <h1>. A listen
        // against this repo's own probe fixture (a11y-fixtures/nvda-modal-
        // probe.html, 28 July 2026) compared the two landing places: focusing
        // the dialog produced two utterances of the name in one pass, against
        // four across two passes when the heading was focused. That is the
        // whole of what was measured, on one reader and one build; nothing
        // here predicts what any other reader or version will say.
        //
        // The heading keeps tabindex="-1" and keeps supplying the dialog's
        // aria-labelledby — neither is touched by this call. No tabindex is
        // needed on the dialog: <dialog> reports tabIndex -1 with no attribute
        // set (measured 28 July 2026), so it is already programmatically
        // focusable, and adding one would put it in trapFocus's list.
        if (typeof modal.focus === "function") modal.focus();
      });

      // Notify other components (like toggletips) that a modal has opened
      document.dispatchEvent(
        new CustomEvent("modalOpened", { detail: { modalId } }),
      );

      logInfo(`Modal ${modalId} displayed with enhanced positioning`);
    }

    close(modalId, result = null) {
      const modalData = this.activeModals.get(modalId);
      if (!modalData) return;

      const modal = modalData.element;

      if (
        window.matchMedia("(prefers-reduced-motion: no-preference)").matches
      ) {
        modal.setAttribute("closing", "");
        setTimeout(() => this.finishClose(modalId, result), 200);
      } else {
        this.finishClose(modalId, result);
      }
    }

    /**
     * Resolves a `returnFocusTo` declaration to a focusable element, at CLOSE
     * time.
     *
     * Resolving late is the point: a string or a function survives the DOM being
     * rebuilt while the modal was open, which is precisely what defeats a
     * captured element (parcel g-6 — the card's Remove button died in the
     * refresh() that followed a delete). A caller that genuinely wants the
     * element it held at open time may still pass the element itself.
     *
     * Returns null rather than throwing for every failure — a bad selector, a
     * throwing function, a target that has been removed, or one that is
     * disabled. A null sends finishClose to its lower tiers, which is a worse
     * landing but never a vanished focus.
     *
     * @param {string|Element|Function|null} spec
     * @returns {Element|null}
     */
    resolveReturnFocusTarget(spec) {
      if (!spec) return null;

      let target = null;
      try {
        if (typeof spec === "function") {
          target = spec();
        } else if (typeof spec === "string") {
          // Bare id first, so the common case needs no selector syntax.
          target =
            document.getElementById(spec) || document.querySelector(spec);
        } else if (spec && spec.nodeType === 1) {
          target = spec;
        } else {
          logWarn(`returnFocusTo has unusable type "${typeof spec}"; ignoring`);
          return null;
        }
      } catch (error) {
        logWarn(`returnFocusTo could not be resolved: ${error.message}`);
        return null;
      }

      if (!target || typeof target.focus !== "function") return null;

      // A disconnected or disabled target cannot take focus, and attempting it
      // would leave focus wherever removeChild left it — usually <body>.
      if (!target.isConnected || target.disabled) {
        logWarn(
          "returnFocusTo resolved to a target that cannot take focus " +
            `(connected: ${target.isConnected}, disabled: ${!!target.disabled})`,
        );
        return null;
      }

      // NOR CAN A TARGET WITH NO LAYOUT BOX — and this one is invisible in
      // every other check. `hidden`, `display: none`, or ANY hidden ancestor
      // leaves the element connected and not disabled, so it passes the test
      // above, resolves, satisfies finishClose's openerUsable, and then
      // .focus() is a SILENT NO-OP that drops focus to <body>. Returning null
      // instead sends finishClose to its lower tiers, which land on the
      // surviving modal or #main — worse than the opener, far better than body.
      //
      // MEASURED, not predicted (20 August 2026, session-manager migration).
      // Deleting every saved session runs updateStorageDashboard(), which
      // re-hides #resume-storage-dashboard because the count is now zero — and
      // #resume-manage-sessions-btn lives inside it. Declaring the opener took
      // that journey from main#main to body: the declaration made the landing
      // WORSE than no declaration. getClientRects() is the same reachability
      // test .claude/a11y/sr/modal-focus-baseline.mjs uses on its triggers,
      // for the same reason.
      if (target.getClientRects().length === 0) {
        logWarn(
          "returnFocusTo resolved to a target with no layout box (hidden, " +
            "display:none, or a hidden ancestor); falling through to the tiers",
        );
        return null;
      }

      return target;
    }

    finishClose(modalId, result) {
      const modalData = this.activeModals.get(modalId);
      if (!modalData) return;

      const modal = modalData.element;

      this.cleanupStatusPositionHandlers(modalId);
      this.cleanupBackgroundCloseHandler(modalId);
      this.cleanupModalInert(modalId);

      modal.close();
      if (modal.parentNode) modal.parentNode.removeChild(modal);

      this.activeModals.delete(modalId);
      this.hasActiveModal = this.activeModals.size > 0;
      this.activeModalElement = this.hasActiveModal
        ? Array.from(this.activeModals.values()).pop().element
        : null;

      // RESOLVED ONCE, HERE, and used by both arms of the restore below.
      // (Added 14 August 2026, parcel F-1.)
      //
      // Deliberately NOT re-read inside the branch after a focus() attempt: an
      // attempt that moved focus into a different dialog would make a later
      // read stale, and the whole point of attempt-and-verify is that the
      // attempt has already happened by the time the branch decides anything.
      //
      // activeModalElement MEANS LAST-OPENED, not visual top and not
      // next-in-order: it is Array.from(this.activeModals.values()).pop()
      // .element over an insertion-ordered Map, so .pop() yields the most
      // recently opened survivor. That is the right question for the top layer,
      // which native <dialog> orders by showModal() call order. Note that this
      // same file computes a DIFFERENT successor in cleanupModalInert — heirId,
      // the OLDEST modal opened after the closing one — because inert custody
      // is a different question. The two agree at stack depth two and can
      // diverge at depth three or on an out-of-order close; the F-1 captures
      // reached NEITHER, so the divergence is real but unmeasured here.
      const remainingModal = this.hasActiveModal ? this.activeModalElement : null;

      // Scroll prevention is still a whole-stack concern — it is a single set of
      // <body> styles owned by the first modal to open, so it can only be undone
      // once the stack empties. Inert is no longer restored here: cleanupModalInert
      // above has already released exactly what this modal added, and the
      // document-wide `[inert]` strip that used to live here destroyed inert set
      // by owners outside UniversalModal (the MathPix fullscreen viewer sets its
      // own, on its own captured list) as well as inert present in authored
      // markup.
      if (!this.hasActiveModal) {
        this.restoreBackgroundScroll();
      }

      // Restore focus. Three tiers (10 July 2026), plus a SURVIVING-MODAL
      // FALLBACK added 14 August 2026 (parcel F-1) that fires ONLY where a tier
      // below it would otherwise land nothing:
      //  1. The saved opener, if it still exists, is connected, and is not
      //     <body> or the skip-link (a captured skip-link/body means the modal
      //     was opened without a focused trigger — restoring there reproduces
      //     the focus-at-top bug).
      //  2. Otherwise the #main landmark, so focus lands at the start of the
      //     main content rather than the page top. This covers the case where
      //     the opener was removed before close (e.g. deleting every saved
      //     session removes the button that opened the manager). #main is the
      //     one always-present, always-visible, id-stable anchor on the page.
      //     tabindex="-1" is set at runtime (native <main> is not focusable),
      //     and { preventScroll: true } stops the focus yanking the viewport,
      //     which would undo the instant scroll-restore above.
      //  3. If neither is reachable, focus is left to the browser's native
      //     <dialog> handling.
      //
      // WHY THE FALLBACK EXISTS, and what it does NOT do. It does NOT take
      // focus away from the opener: tier 1 runs first and unchanged, and where
      // tier 1 lands, nothing else happens. An earlier version of this parcel
      // put the surviving dialog FIRST and was withdrawn, because on the
      // measured journeys it moved focus off the control the person had just
      // pressed and onto the dialog, losing their position in an eleven-item
      // grid. That was a regression traded for an accident, which is a worse
      // deal than the accident.
      //
      // WHAT IT DOES CLOSE, measured 14 August 2026 on the images-remain delete
      // (Remove a card, then Yes). Without the fallback, refresh() rebuilds the
      // grid, so the saved opener is DISCONNECTED, tier 1 is skipped, and tier 2
      // aims at #main — which is inert while the manager is open — so nothing
      // lands and focus sits on <body>, where removeChild left it. Focus was
      // observed passing through <body> at +1419ms before the image manager's
      // own g-9b landing recovered it at +1477ms. With the fallback there is no
      // <body> window at all.
      //   ⚠ LIMITS OF THAT MEASUREMENT, so it is not over-read: n=1 per
      //   condition, the activeElement poll STARVED on the with-fallback arm
      //   (first sample at +571ms), so only the SETTLED outcome is solid and
      //   the timings are indicative. Both arms settled identically, on the
      //   next card's alt button — the fallback did NOT disturb the g-9b
      //   landing, which was measured and HEARD on 12 August 2026.
      // OPT-IN (20 August 2026). A modal that DECLARED where focus should return
      // reads its own per-modal record; one that did not keeps the shared field
      // and the behaviour it has always had.
      //
      // A declared target that resolves to nothing deliberately does NOT fall
      // back to this.originalFocus. That field may hold an element belonging to
      // some other modal on the stack, and silently reintroducing it to a caller
      // that explicitly opted out of it is the defect wearing a disguise. Null
      // here means the tiers below decide, which is the honest outcome.
      const opener = modalData.returnFocusTo
        ? this.resolveReturnFocusTarget(modalData.returnFocusTo)
        : this.originalFocus;
      const skipLink = document.getElementById("skipToContent");
      const openerUsable =
        opener &&
        typeof opener.focus === "function" &&
        opener.isConnected &&
        opener !== document.body &&
        opener !== skipLink;

      // The surviving-modal fallback, defined once and used by both arms so the
      // two cannot drift apart.
      //
      // ⚠ NAMED CONNECTION — READ THIS BEFORE CHANGING THE 300ms CLOSE IN
      // mathpix-scripts/ui/components/mathpix-image-manager-ui.js.
      //
      // That file's MathPixImageManagerUI._returnFocus() focuses its captured
      // trigger, #resume-manage-images-btn. It runs from the show() promise
      // reaction — Modal.prototype.open attaches .then, and modalData.resolve
      // below enqueues it — so it runs AFTER this entire synchronous body and
      // therefore LANDS LAST AND WINS. Measured in the F-1 before capture at
      // +1080ms against tier 1 at +1068ms, both aiming at the same element.
      //
      // Today that redundancy is harmless. It stops being harmless if the image
      // manager itself ever closes while another modal REMAINS on the stack:
      // this fallback would aim at the surviving dialog, and _returnFocus would
      // then yank focus to #resume-manage-images-btn, which at that moment sits
      // behind the top layer and is unreachable — a focus call that lands
      // nowhere.
      //
      // AND IT WOULD BE SILENT. The identity check below would have already
      // passed, because at that instant the fallback had genuinely landed;
      // _returnFocus undoes it afterwards, outside anything this method can
      // see. The failure would read clean from here.
      //
      // The ONLY thing preventing it today is the last-image path in that
      // file's handleDelete(), which closes the manager via
      // setTimeout(() => this.close(), 300) — and whose own comment records
      // that the delay exists so the confirm has left the stack first. Shorten
      // or remove that delay and this becomes reachable.
      const focusSurvivingModal = () => {
        if (typeof remainingModal.focus === "function") {
          remainingModal.focus();
        }

        // Verified by IDENTITY, immediately, and never retried. Identity is
        // DELIBERATE rather than a containment test: no opener reachable in
        // this app can delegate focus to a descendant — there is no
        // attachShadow and no delegatesFocus anywhere in the shipped tree, the
        // one custom element carries no shadow root and no tabindex, a <label>
        // is not focusable so it can never be the opener, and a native <dialog>
        // focused by .focus() lands on itself. An opener that COULD delegate
        // would need this test revisited.
        //
        // The two ways the call can fail share no attribute: an inert ancestor
        // is readable from the DOM, a top-layer block is not, and
        // closest("[inert]") passes the second one clean — measured 14 August
        // 2026 on a control inside a lower dialog, which read insideInert false
        // while being unreachable. Only comparing document.activeElement
        // catches both. No retry and no onward fallback: the tiers below would
        // put focus behind the very dialog that is still open.
        if (document.activeElement !== remainingModal) {
          logWarn(
            `Modal ${modalId} closed with ${this.activeModals.size} modal(s) still open, ` +
              `but focus did not land on the remaining modal (${
                remainingModal.id || "no id"
              }); document.activeElement is ${
                document.activeElement
                  ? document.activeElement.tagName.toLowerCase()
                  : "null"
              }`,
          );
        }
      };

      if (openerUsable) {
        // ATTEMPT-AND-VERIFY. The attempt tests the real thing rather than a
        // proxy for it, and a focus() call on a top-layer-blocked element was
        // measured to be a complete no-op — focus does not move at all, so
        // attempting costs nothing and cannot leave focus anywhere worse.
        opener.focus();

        // The ONLY new behaviour on this arm, and it is unreachable unless the
        // attempt failed. Where tier 1 lands — every journey either F-1 capture
        // could reach — nothing below runs and the outcome is byte-identical to
        // the pre-parcel build.
        if (remainingModal && document.activeElement !== opener) {
          focusSurvivingModal();
        }
      } else if (remainingModal) {
        // Tier 1 was skipped and tier 2 cannot land: #main is inert while any
        // modal is open. Without this arm focus stays wherever removeChild left
        // it, which is <body>.
        focusSurvivingModal();
      } else {
        const main = document.getElementById("main");
        if (main) {
          if (!main.hasAttribute("tabindex")) {
            main.setAttribute("tabindex", "-1");
          }
          main.focus({ preventScroll: true });
        }
      }

      modalData.resolve(result);
      logInfo(`Modal ${modalId} closed with enhanced cleanup`);
    }

    trapFocus(e, modal) {
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    }

    /**
     * Make the background inert for one modal, recording exactly which elements
     * THIS modal changed.
     *
     * The selector is unchanged. What is new is the `hasAttribute` test: an
     * element already carrying `inert` — because an outer modal swept it, or
     * because an owner outside UniversalModal set it — is left alone and is NOT
     * recorded, so this modal's close can never release somebody else's inert.
     *
     * The added-set is only derivable here. Once the sweep has run the attribute
     * reads identically whoever set it, so nothing downstream can reconstruct
     * it; that is why the record is taken inside the loop rather than by
     * diffing the DOM either side of the call.
     *
     * @param {string} modalId - the modal whose sweep this is.
     */
    makeBackgroundInert(modalId) {
      const mainElements = document.querySelectorAll(
        "body > *:not(dialog):not(script):not(style)",
      );

      const added = new Set();
      mainElements.forEach((element) => {
        if (element.hasAttribute("inert")) return;
        element.setAttribute("inert", "");
        added.add(element);
      });

      // A second sweep under the same id would find its own first-sweep
      // elements already inert and record an empty set, which on close would
      // leave them inert forever. Merging keeps the record cumulative so that
      // cannot happen. Unreachable through show() — modalId is minted from an
      // incrementing counter — hence a warn rather than a silent merge.
      const existing = this.modalInertElements.get(modalId);
      if (existing) {
        existing.forEach((element) => added.add(element));
        logWarn(
          `Modal ${modalId} swept the background twice; inert sets merged (${added.size} element(s))`,
        );
      }

      this.modalInertElements.set(modalId, added);
      logDebug(
        `Modal ${modalId} made ${added.size} background element(s) inert`,
      );
    }

    /**
     * Release the `inert` this modal added, and drain its Map entry.
     *
     * Called UNCONDITIONALLY from finishClose beside the other two cleanups —
     * not under `!hasActiveModal` — so a nested modal releases its own
     * additions the moment it closes, rather than stranding them for the
     * lifetime of the modal underneath it. Elements this modal did not change
     * are never touched, so the outer modal's background stays inert and any
     * inert set outside UniversalModal survives.
     *
     * One case is a hand-over rather than a release. Every element in this set
     * was NOT inert before this modal's sweep, so no OLDER modal needs it — but
     * a NEWER modal's sweep skipped it precisely because this modal had already
     * set it, and that newer modal does need it. So when a modal opened after
     * this one is still open, the set is handed to the oldest such modal
     * instead of being freed. Without that, closing an outer modal before an
     * inner one would free the page behind a modal that is still showing. In
     * the ordinary last-opened-closes-first case there is no newer modal and
     * the set is simply released.
     *
     * @param {string} modalId - the modal that is closing.
     */
    cleanupModalInert(modalId) {
      const owned = this.modalInertElements.get(modalId);
      if (!owned) return;

      // Map iteration is insertion order, which is open order, so the next key
      // after this one is the oldest modal opened after it.
      const openOrder = Array.from(this.modalInertElements.keys());
      const heirId = openOrder[openOrder.indexOf(modalId) + 1] || null;

      this.modalInertElements.delete(modalId);

      if (heirId) {
        const heir = this.modalInertElements.get(heirId);
        owned.forEach((element) => heir.add(element));
        logDebug(
          `Modal ${modalId} closed out of order; ${owned.size} inert element(s) handed to ${heirId}`,
        );
        return;
      }

      owned.forEach((element) => element.removeAttribute("inert"));
      logDebug(`Modal ${modalId} released ${owned.size} inert element(s)`);
    }

    getCurrentModal() {
      return this.activeModalElement;
    }

    getCurrentModalId() {
      if (this.hasActiveModal) {
        const modalData = Array.from(this.activeModals.values()).pop();
        return modalData ? modalData.id : null;
      }
      return null;
    }

    isModalActive() {
      return this.hasActiveModal;
    }

    getTemplate(template) {
      const templates = {
        alert: {
          buttons: [{ text: "OK", type: "primary", action: "close" }],
          allowBackgroundClose: false,
        },
        confirm: {
          buttons: [
            { text: "Cancel", type: "secondary", action: "cancel" },
            { text: "OK", type: "primary", action: "confirm" },
          ],
          allowBackgroundClose: true,
        },
        prompt: {
          hasInput: true,
          buttons: [
            { text: "Cancel", type: "secondary", action: "cancel" },
            { text: "OK", type: "primary", action: "confirm" },
          ],
          allowBackgroundClose: true,
        },
      };
      return templates[template] || {};
    }
  }

  // Create singleton instance
  const modalManager = new ModalManager();

  // ====== BACKWARD COMPATIBILITY LAYER ======

  /**
   * Legacy Modal class for backward compatibility
   * Maps old API to new implementation
   */
  function Modal(options) {
    options = options || {};

    this.options = {
      id: options.id || `universal-modal-${Date.now()}`,
      title: options.title || "Modal Dialog",
      content: options.content || "",
      size: options.size || "medium",
      closeOnOverlayClick: options.closeOnOverlayClick !== false,
      closeOnEscape: options.closeOnEscape !== false,
      // STILL DROPPED, deliberately (20 August 2026): closeOnEscape and
      // focusElement are accepted here and never reach modalManager, because
      // neither has manager-side support — the escape handler keys off
      // allowBackgroundClose, and there is no focus-target plumbing. Forwarding
      // them would be a real behaviour change wearing the clothes of a bug fix.
      // className and returnFocusTo ARE forwarded; see Modal.prototype.open.
      focusElement: options.focusElement || null,
      className: options.className || "",
      returnFocusTo: options.returnFocusTo || null,
      onOpen: options.onOpen || null,
      onClose: options.onClose || null,
      onBeforeClose: options.onBeforeClose || null,
    };

    this.modal = null;
    this.isOpen = false;
    this.previousActiveElement = null;
    this._resolvePromise = null;

    logInfo(`Legacy Modal instance created with ID: ${this.options.id}`);
  }

  Modal.prototype.open = function (callback) {
    if (this.isOpen) {
      logWarn("Modal is already open");
      return this;
    }

    // Use new system under the hood
    const config = {
      title: this.options.title,
      content: this.options.content,
      size: this.options.size,
      className: this.options.className,
      returnFocusTo: this.options.returnFocusTo,
      options: {
        allowBackgroundClose: this.options.closeOnOverlayClick,
      },
    };

    modalManager.show(config).then((result) => {
      this.isOpen = false;
      if (typeof this.options.onClose === "function") {
        this.options.onClose(this);
      }
      if (callback) callback(this);
    });

    this.isOpen = true;
    this.modal = modalManager.getCurrentModal();

    if (typeof this.options.onOpen === "function") {
      this.options.onOpen(this);
    }

    return this;
  };

  Modal.prototype.close = function (callback) {
    if (!this.isOpen) {
      logWarn("Modal is not open");
      if (callback) callback(this);
      return this;
    }

    let canClose = true;
    if (typeof this.options.onBeforeClose === "function") {
      canClose = this.options.onBeforeClose(this) !== false;
    }

    if (!canClose) {
      logDebug("Modal close prevented by onBeforeClose callback");
      if (callback) callback(this);
      return this;
    }

    // ---------------------------------------------------------------------
    // Close THIS modal, not merely the stack top.
    // (Added 10 July 2026.) Modal.prototype.close() historically closed
    // modalManager.getCurrentModalId() — the top of the stack — on the
    // assumption that the instance calling close() was always the topmost
    // modal. That breaks when a confirm/alert is opened OVER a modal and then
    // dismissed: on the default animated path the child modal lingers on the
    // stack for ~200ms (its finishClose is deferred by setTimeout), so a
    // parent that calls close() during that window closes the already-closing
    // child and leaves itself open. Observed in the session-manager and
    // image-manager delete-to-empty flows.
    //
    // Fix: prefer this instance's own modal id (this.modal.id, stamped in
    // createModal()); fall back to the stack top only when this.modal is
    // absent (a never-opened instance — already filtered by the isOpen guard
    // above, so the fallback is effectively unreachable in production and
    // preserves the exact legacy behaviour if it ever is).
    //
    // To revert: replace the line below with
    //   const modalId = modalManager.getCurrentModalId();
    // and delete this comment. No other code changed for this fix.
    // ---------------------------------------------------------------------
    const modalId = this.modal?.id || modalManager.getCurrentModalId();
    if (modalId) {
      modalManager.close(modalId);
    }

    if (callback) {
      callback(this);
    }

    return this;
  };

  Modal.prototype.setContent = function (content) {
    if (!this.modal) {
      logWarn("Cannot set content: modal not created yet");
      return this;
    }

    const bodyElement = this.modal.querySelector(".universal-modal-body");
    if (bodyElement) {
      bodyElement.innerHTML = content;
      logDebug("Modal content updated");
    }
    return this;
  };

  Modal.prototype.setTitle = function (title) {
    if (!this.modal) {
      logWarn("Cannot set title: modal not created yet");
      return this;
    }

    const titleElement = this.modal.querySelector(".universal-modal-heading");
    if (titleElement) {
      titleElement.textContent = title;
      logDebug("Modal title updated");
    }
    return this;
  };

  Modal.prototype.destroy = function () {
    if (this.isOpen) {
      this.close();
    }

    this.modal = null;
    logInfo("Modal destroyed and cleaned up");
    return this;
  };

  // ====== PUBLIC API METHODS (NEW STYLE) ======

  function show(config) {
    return modalManager.show(config);
  }

  function alert(message, options = {}) {
    return show({
      title: options.title || "Alert",
      content: message,
      type: options.type || "info",
      size: options.size || "small",
      template: "alert",
      options: { allowBackgroundClose: false, ...options },
    });
  }

  function confirm(message, options = {}) {
    return show({
      title: options.title || "Confirm",
      content: message,
      type: options.type || "confirmation",
      size: options.size || "medium",
      template: "confirm",
      options: { allowBackgroundClose: true, ...options },
    });
  }

  function prompt(message, options = {}) {
    return show({
      title: options.title || "Input Required",
      content: message,
      type: options.type || "info",
      size: options.size || "medium",
      template: "prompt",
      options: { allowBackgroundClose: true, ...options },
    });
  }

  function custom(content, options = {}) {
    return show({
      title: options.title || "Modal",
      content: content,
      type: options.type || "info",
      size: options.size || "medium",
      buttons: options.buttons || [],
      options: options,
    });
  }

  // ====== LEGACY API METHODS (BACKWARD COMPATIBILITY) ======

  /**
   * Legacy showAlert - matches old signature: showAlert(title, message, options)
   */
  function showAlert(title, message, options) {
    options = options || {};

    return new Promise(function (resolve) {
      const modal = new Modal({
        title: title,
        content: `<div class="universal-alert-content"><p>${escapeHtml(
          message,
        )}</p></div>`,
        size: options.size || "small",
        className: options.className || "universal-alert",
        closeOnOverlayClick: options.closeOnOverlayClick !== false,
        closeOnEscape: options.closeOnEscape !== false,
        onClose: function (modalInstance) {
          modalInstance.destroy();
          if (typeof options.onClose === "function") {
            options.onClose();
          }
          resolve(modalInstance);
        },
      });
      modal.open();
    });
  }

  /**
   * Legacy showConfirm - matches old signature: showConfirm(title, message, options)
   */
  function showConfirm(title, message, options) {
    options = options || {};
    const confirmText = options.confirmText || "Yes";
    const cancelText = options.cancelText || "No";

    return new Promise(function (resolve) {
      const content = `
        <div class="universal-confirm-content confirmation-content">
          <p>${escapeHtml(message)}</p>
          <div class="universal-confirm-actions confirmation-actions">
            <button type="button" class="universal-confirm-yes modal-confirm-yes" autofocus>${escapeHtml(
              confirmText,
            )}</button>
            <button type="button" class="universal-confirm-no modal-confirm-no">${escapeHtml(
              cancelText,
            )}</button>
          </div>
        </div>
      `;

      const modal = new Modal({
        title: title,
        content: content,
        size: options.size || "small",
        className: options.className || "universal-confirm",
        closeOnOverlayClick: false,
        closeOnEscape: true,
        onOpen: function (modalInstance) {
          const yesButton = modalInstance.modal.querySelector(
            ".universal-confirm-yes",
          );
          const noButton = modalInstance.modal.querySelector(
            ".universal-confirm-no",
          );

          yesButton.addEventListener("click", function () {
            modalInstance.close();
            resolve(true);
          });

          noButton.addEventListener("click", function () {
            modalInstance.close();
            resolve(false);
          });

          if (typeof options.onOpen === "function") {
            options.onOpen(modalInstance);
          }
        },
        onClose: function (modalInstance) {
          modalInstance.destroy();
          if (typeof options.onClose === "function") {
            options.onClose();
          }
        },
        onBeforeClose: function () {
          setTimeout(() => resolve(false), 0);
          return true;
        },
      });

      modal.open();
    });
  }

  /**
   * Escape HTML to prevent XSS
   */
  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Fallback for when modal system isn't working
   */
  function fallbackToNative(message, type) {
    logWarn(`Falling back to native ${type} dialog`);

    if (window.UniversalNotifications) {
      window.UniversalNotifications.warning(
        `Modal system unavailable, using native ${type}`,
      );
    }

    if (type === "confirm") {
      return confirm(message);
    } else {
      alert(message);
    }
  }

  // ====== DEBUG FUNCTIONS (PRESERVED) ======

  function checkModalCompliance(modal) {
    if (!modal) return null;

    const compliance = {
      hasRole: modal.getAttribute("role") === "dialog",
      hasAriaModal: modal.getAttribute("aria-modal") === "true",
      // Read the effective tabIndex, not the attribute. A <dialog> reports
      // tabIndex === -1 natively with no attribute present, and UM-3 declined to
      // add one because trapFocus's selector includes
      // [tabindex]:not([tabindex="-1"]) — an attribute here would put the dialog
      // itself into the focus cycle. Requiring the attribute made isCompliant
      // unreachable for every modal this system creates.
      hasTabIndex: modal.tabIndex === -1,
      hasLabel:
        modal.hasAttribute("aria-label") ||
        modal.hasAttribute("aria-labelledby"),
      isDialogElement: modal.tagName.toLowerCase() === "dialog",

      labelSource: modal.hasAttribute("aria-label")
        ? "aria-label"
        : modal.hasAttribute("aria-labelledby")
          ? "aria-labelledby"
          : "none",
      labelValue: modal.hasAttribute("aria-label")
        ? modal.getAttribute("aria-label")
        : modal.hasAttribute("aria-labelledby")
          ? modal.getAttribute("aria-labelledby")
          : null,

      canReceiveFocus: (function () {
        try {
          const originalActiveElement = document.activeElement;
          modal.focus();
          const canFocus = document.activeElement === modal;
          if (originalActiveElement && originalActiveElement.focus) {
            originalActiveElement.focus();
          }
          return canFocus;
        } catch (error) {
          return false;
        }
      })(),

      get isCompliant() {
        return (
          this.hasRole &&
          this.hasAriaModal &&
          this.hasTabIndex &&
          this.hasLabel &&
          this.canReceiveFocus
        );
      },
    };

    return compliance;
  }

  function quickDiagnostic() {
    logInfo("🚀 Quick Modal Diagnostic");

    let modal = document.querySelector(".universal-modal[open], dialog[open]");

    if (!modal) {
      logInfo(
        "🔧 No modal currently open, creating test modal for diagnostic...",
      );

      const testModal = new Modal({
        title: "Diagnostic Test Modal",
        content: `
          <div>
            <p>This is a test modal for diagnostic purposes.</p>
            <button type="button" class="test-button">Test Button</button>
            <input type="text" placeholder="Test input" />
            <p>Use this modal to test focus management and accessibility.</p>
          </div>
        `,
        size: "medium",
        className: "diagnostic-test-modal",
        onClose: function () {
          logInfo("🔍 Diagnostic test modal closed");
        },
      });

      testModal.open();
      modal = testModal.modal;

      logInfo("✅ Test modal created for diagnostic. Modal ID:", modal.id);
    }

    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const closeButtons = Array.from(focusableElements).filter(
      (el) =>
        el.classList.contains("modal-close-button") ||
        el.classList.contains("universal-modal-close"),
    );
    const compliance = checkModalCompliance(modal);

    logInfo(`✅ Modal found: ${modal.id}`);
    logInfo(`📊 Focusable elements: ${focusableElements.length}`);
    logInfo(`🔘 Close buttons: ${closeButtons.length}`);

    logInfo("🔍 Compliance Check:");
    logInfo(`  role="dialog": ${compliance.hasRole ? "✅" : "❌"}`);
    logInfo(`  aria-modal="true": ${compliance.hasAriaModal ? "✅" : "❌"}`);
    logInfo(`  tabindex="-1": ${compliance.hasTabIndex ? "✅" : "❌"}`);
    logInfo(
      `  Label (${compliance.labelSource}): ${
        compliance.hasLabel ? "✅" : "❌"
      }`,
    );
    logInfo(`  Can receive focus: ${compliance.canReceiveFocus ? "✅" : "❌"}`);
    logInfo(`  Overall compliant: ${compliance.isCompliant ? "✅" : "❌"}`);

    if (!compliance.isCompliant) {
      logWarn("❌ Modal does not meet standards!");
    }

    if (closeButtons.length === 0) {
      logError("❌ No close button detected!");
    } else {
      logInfo("✅ Close button(s) detected and focusable");
    }

    return {
      modalExists: true,
      focusableCount: focusableElements.length,
      closeButtonCount: closeButtons.length,
      compliance: compliance,
      elements: Array.from(focusableElements),
      modal: modal,
    };
  }

  function testModal() {
    logInfo("🧪 Testing modal...");

    const testModal = new Modal({
      title: "Test Modal",
      content: `
        <div>
          <p>This modal demonstrates proper functionality:</p>
          <ul>
            <li>✅ Focus management</li>
            <li>✅ Tab cycling</li>
            <li>✅ Escape key support</li>
            <li>✅ Focus return</li>
          </ul>
          <button type="button" class="test-btn-1">Button 1</button>
          <input type="text" placeholder="Test input" class="test-input">
          <button type="button" class="test-btn-2">Button 2</button>
        </div>
      `,
      size: "medium",
      className: "test-modal",
    });

    testModal.open();

    setTimeout(() => {
      const compliance = checkModalCompliance(testModal.modal);
      logInfo("📊 Test Modal Compliance:");
      logInfo(`  Overall compliant: ${compliance.isCompliant ? "✅" : "❌"}`);
    }, 200);
  }

  // Log module initialization
  logInfo("Universal Modal system initialized with backward compatibility");

  // ====== PUBLIC API ======
  return {
    // Core modal class (legacy)
    Modal: Modal,

    // Legacy convenience functions (old signatures)
    showAlert: showAlert, // showAlert(title, message, options)
    showConfirm: showConfirm, // showConfirm(title, message, options)

    // Direct constructor
    create: function (options) {
      return new Modal(options);
    },

    // New API methods
    show,
    alert, // alert(message, options) - title in options
    confirm, // confirm(message, options) - title in options
    prompt,
    custom,

    // Status methods
    isModalActive: () => modalManager.isModalActive(),
    getCurrentModal: () => modalManager.getCurrentModal(),
    getCurrentModalId: () => modalManager.getCurrentModalId(),

    // In-modal status methods
    showStatus: (message, type, options) => {
      const modalId = modalManager.getCurrentModalId();
      if (modalId)
        modalManager.showModalStatus(modalId, message, type, options);
    },
    hideStatus: () => {
      const modalId = modalManager.getCurrentModalId();
      if (modalId) modalManager.hideModalStatus(modalId);
    },
    updateStatus: (message, type, options) => {
      const modalId = modalManager.getCurrentModalId();
      if (modalId)
        modalManager.updateModalStatus(modalId, message, type, options);
    },

    // Utilities
    escapeHtml: escapeHtml,

    // Built-in debugging tools
    quickDiagnostic: quickDiagnostic,
    checkCompliance: checkModalCompliance,
    testModal: testModal,

    // Logging control
    setLogLevel: function (level) {
      // Implementation would go here
    },
  };
})();

// ====== GLOBAL INTEGRATION (PRESERVED) ======

// Export for environments that support it
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalModal;
}

// For AMD (RequireJS) environments
if (typeof define === "function" && define.amd) {
  define(function () {
    return UniversalModal;
  });
}

// Make available globally
window.UniversalModal = UniversalModal;

// Convenient global shortcuts (preserved for compatibility)
window.modalAlert = UniversalModal.alert;
window.modalConfirm = UniversalModal.confirm;
window.showModal = UniversalModal.create;

// Safe wrapper functions (preserved)
window.safeConfirm = function (message, title = "Confirm", options = {}) {
  return new Promise(async function (resolve) {
    try {
      // Use legacy API signature for compatibility
      const result = await UniversalModal.showConfirm(title, message, options);
      resolve(result);
    } catch (error) {
      console.error("Modal confirm failed, falling back to native:", error);
      resolve(confirm(message));
    }
  });
};

window.safeAlert = function (message, title = "Alert", options = {}) {
  return new Promise(async function (resolve) {
    try {
      // Use legacy API signature for compatibility
      await UniversalModal.showAlert(title, message, options);
      resolve();
    } catch (error) {
      console.error("Modal alert failed, falling back to native:", error);
      alert(message);
      resolve();
    }
  });
};

// Debugging functions (preserved)
window.quickModalDiagnostic = UniversalModal.quickDiagnostic;
window.testModalFocus = UniversalModal.testModal;
window.checkModalCompliance = function () {
  let modal = document.querySelector(".universal-modal[open], dialog[open]");

  if (!modal) {
    console.log(
      "🔧 No modal currently open, creating test modal for compliance check...",
    );

    const testModal = new UniversalModal.Modal({
      title: "Compliance Test Modal",
      content: `
        <div>
          <p>This modal is being tested for compliance.</p>
          <button type="button" class="test-button">Test Button</button>
          <input type="text" placeholder="Test input" />
          <a href="#" onclick="event.preventDefault();">Test Link</a>
        </div>
      `,
      size: "medium",
      className: "compliance-test-modal",
    });

    testModal.open();
    modal = testModal.modal;

    console.log("✅ Test modal created for compliance check");
  }

  const compliance = UniversalModal.checkCompliance(modal);
  console.log("🔍 Compliance Report for:", modal.id);
  console.table(compliance);

  if (compliance.isCompliant) {
    console.log("✅ Modal is fully compliant!");
  } else {
    console.log("❌ Modal needs improvements for compliance");
  }

  return compliance;
};
