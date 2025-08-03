// Focus Tracking Utility for Accessibility Testing
const FocusTracker = {
  isActive: false,
  logFocusChanges: null,

  describeElement(el) {
    if (!el) return "No element focused";

    let desc = el.tagName.toLowerCase();

    // Add ID if present
    if (el.id) desc += `#${el.id}`;

    // Add classes if present
    if (el.className && el.className.toString().trim()) {
      desc += `.${el.className.toString().trim().replace(/\s+/g, ".")}`;
    }

    // Add type attribute for inputs
    if (el.type) desc += `[type="${el.type}"]`;

    // Add aria-label if present
    if (el.getAttribute("aria-label")) {
      desc += ` (aria-label: "${el.getAttribute("aria-label")}")`;
    }

    // Add parent context for better identification
    if (el.parentElement) {
      let parentDesc = el.parentElement.tagName.toLowerCase();
      if (el.parentElement.id) parentDesc += `#${el.parentElement.id}`;
      if (el.parentElement.className) {
        const parentClasses = el.parentElement.className
          .toString()
          .trim()
          .replace(/\s+/g, ".");
        if (parentClasses) parentDesc += `.${parentClasses}`;
      }
      desc += ` (in ${parentDesc})`;
    }

    return desc;
  },

  start() {
    if (this.isActive) {
      console.warn("Focus tracking already active");
      return;
    }

    console.log("🎯 Starting focus tracking for accessibility testing...");

    this.logFocusChanges = (event) => {
      const elementDesc = this.describeElement(document.activeElement);
      const eventType = event.type === "focusin" ? "FOCUS IN" : "FOCUS OUT";

      console.log(
        `%c${eventType}:`,
        "color: #2563eb; font-weight: bold;",
        elementDesc
      );

      // Also check for focus-visible state
      if (
        document.activeElement &&
        document.activeElement.matches &&
        document.activeElement.matches(":focus-visible")
      ) {
        console.log(`%c  → Focus-visible: YES`, "color: #16a34a;");
      } else if (document.activeElement) {
        console.log(`%c  → Focus-visible: NO`, "color: #dc2626;");
      }
    };

    // Listen for both focusin and focusout events
    document.addEventListener("focusin", this.logFocusChanges);
    document.addEventListener("focusout", this.logFocusChanges);

    this.isActive = true;

    // Log initial state
    console.log(
      `%cINITIAL FOCUS:`,
      "color: #7c3aed; font-weight: bold;",
      this.describeElement(document.activeElement)
    );

    console.log(
      "✅ Focus tracking active - use stopFocusTracking() to disable"
    );
  },

  stop() {
    if (!this.isActive) {
      console.warn("Focus tracking not active");
      return;
    }

    if (this.logFocusChanges) {
      document.removeEventListener("focusin", this.logFocusChanges);
      document.removeEventListener("focusout", this.logFocusChanges);
      this.logFocusChanges = null;
    }

    this.isActive = false;
    console.log("🛑 Focus tracking stopped");
  },

  getCurrentFocus() {
    return {
      element: document.activeElement,
      description: this.describeElement(document.activeElement),
      isFocusVisible:
        document.activeElement &&
        document.activeElement.matches &&
        document.activeElement.matches(":focus-visible"),
    };
  },
};

// Global functions for console use
function trackFocus() {
  FocusTracker.start();
}

function stopFocusTracking() {
  FocusTracker.stop();
}

function getCurrentFocus() {
  const info = FocusTracker.getCurrentFocus();
  console.log("Current focus:", info.description);
  console.log("Focus-visible:", info.isFocusVisible);
  return info;
}

// Make functions globally available
window.trackFocus = trackFocus;
window.stopFocusTracking = stopFocusTracking;
window.getCurrentFocus = getCurrentFocus;

// Console Commands Available Notification
{{#if enableConsoleCommands}}
setTimeout(() => {
    console.log('🎯 Focus tracking commands available:');
    console.log('  - trackFocus() - Start focus tracking');
    console.log('  - stopFocusTracking() - Stop focus tracking');
    console.log('  - getCurrentFocus() - Check current focus');
}, {{commandsDelayMs}});
{{/if}}
window.FocusTracker = FocusTracker;
