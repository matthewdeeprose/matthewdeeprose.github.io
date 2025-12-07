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
        `Scroll prevented at position: ${this.originalScrollPosition}px`
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
        window.scrollTo(0, this.originalScrollPosition);
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
            position
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
        });

        this.hasActiveModal = true;
        this.activeModalElement = modal;
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
        finalOptions.allowBackgroundClose !== false
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
        icon.setAttribute("aria-label", `${type} icon`);
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
      statusArea.setAttribute("aria-live", "polite");
      statusArea.setAttribute("aria-atomic", "true");
      statusArea.setAttribute("role", "status");
      statusArea.setAttribute("aria-relevant", "additions text");

      statusArea.innerHTML = `
        <span class="universal-modal-status-icon" aria-hidden="true"></span>
        <div class="universal-modal-status-text"></div>
        <button type="button" class="universal-modal-status-dismiss" aria-label="Dismiss notification" style="display: none;">
          <span aria-hidden="true">×</span>
        </button>
      `;

      const dismissBtn = statusArea.querySelector(
        ".universal-modal-status-dismiss"
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
        ".universal-modal-status-icon"
      );
      const textElement = statusArea.querySelector(
        ".universal-modal-status-text"
      );
      const dismissBtn = statusArea.querySelector(
        ".universal-modal-status-dismiss"
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
          statusArea.className = "universal-modal-status normal-viewport";
        }
      }, 300);

      logDebug("Modal status hidden");
    }

    updateModalStatus(modalId, message, type = "info", options = {}) {
      this.showModalStatus(modalId, message, type, options);
    }

    addModalEventListeners(modal, modalId, options, resolve) {
      modal.addEventListener("click", (e) => {
        if (e.target === modal && options.allowBackgroundClose !== false) {
          this.close(modalId, "background");
        }
      });

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
      this.makeBackgroundInert();

      requestAnimationFrame(() => {
        this.setupStatusPositionHandlers(modal, modalId);
        this.updateStatusPosition(modalId);

        const heading = modal.querySelector(".universal-modal-heading");
        if (heading) heading.focus();
      });

      // Notify other components (like toggletips) that a modal has opened
      document.dispatchEvent(
        new CustomEvent("modalOpened", { detail: { modalId } })
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

    finishClose(modalId, result) {
      const modalData = this.activeModals.get(modalId);
      if (!modalData) return;

      const modal = modalData.element;

      this.cleanupStatusPositionHandlers(modalId);

      modal.close();
      if (modal.parentNode) modal.parentNode.removeChild(modal);

      this.activeModals.delete(modalId);
      this.hasActiveModal = this.activeModals.size > 0;
      this.activeModalElement = this.hasActiveModal
        ? Array.from(this.activeModals.values()).pop().element
        : null;

      if (!this.hasActiveModal) {
        this.restoreBackground();
        this.restoreBackgroundScroll();
      }

      if (
        this.originalFocus &&
        typeof this.originalFocus.focus === "function"
      ) {
        this.originalFocus.focus();
      }

      modalData.resolve(result);
      logInfo(`Modal ${modalId} closed with enhanced cleanup`);
    }

    trapFocus(e, modal) {
      const focusableElements = modal.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
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

    makeBackgroundInert() {
      const mainElements = document.querySelectorAll(
        "body > *:not(dialog):not(script):not(style)"
      );
      mainElements.forEach((element) => {
        element.setAttribute("inert", "");
      });
    }

    restoreBackground() {
      const inertElements = document.querySelectorAll("[inert]");
      inertElements.forEach((element) => element.removeAttribute("inert"));
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
      focusElement: options.focusElement || null,
      className: options.className || "",
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

    const modalId = modalManager.getCurrentModalId();
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
          message
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
              confirmText
            )}</button>
            <button type="button" class="universal-confirm-no modal-confirm-no">${escapeHtml(
              cancelText
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
            ".universal-confirm-yes"
          );
          const noButton = modalInstance.modal.querySelector(
            ".universal-confirm-no"
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
        `Modal system unavailable, using native ${type}`
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
      hasTabIndex: modal.hasAttribute("tabindex") && modal.tabIndex === -1,
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
        "🔧 No modal currently open, creating test modal for diagnostic..."
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
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const closeButtons = Array.from(focusableElements).filter(
      (el) =>
        el.classList.contains("modal-close-button") ||
        el.classList.contains("universal-modal-close")
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
      }`
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
      "🔧 No modal currently open, creating test modal for compliance check..."
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
