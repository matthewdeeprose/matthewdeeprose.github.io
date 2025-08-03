// templates/js/initialization.js
// Related HTML templates: integrated-document-sidebar.html, reading-tools-section.html
// Purpose: Initialize all document components for exported HTML files
// Migration target: template-system.js generateInitializationJS()

// Component Initialization Manager
function initializeAllComponents() {
  // Initialize Reading Accessibility Manager
  if (typeof ReadingAccessibilityManager !== "undefined") {
    window.readingAccessibilityManager = new ReadingAccessibilityManager();
    console.log("✅ Reading Accessibility Manager initialized");
  } else {
    console.warn("⚠️ ReadingAccessibilityManager class not found");
  }

  // Initialize Theme Toggle Manager
  if (typeof ThemeToggleManager !== "undefined") {
    window.themeToggleManager = new ThemeToggleManager();
    console.log("✅ Theme Toggle Manager initialized");
  }

  // Initialize Print Button Manager
  if (typeof PrintButtonManager !== "undefined") {
    window.printButtonManager = new PrintButtonManager();
    console.log("✅ Print Button Manager initialized");
  }

  // Initialize Reset Controls Manager
  if (typeof ResetControlsManager !== "undefined") {
    window.resetControlsManager = new ResetControlsManager();
    console.log("✅ Reset Controls Manager initialized");
  }

  // Initialize MathJax Controls Manager
  if (typeof MathJaxControlsManager !== "undefined") {
    window.mathJaxControlsManager = new MathJaxControlsManager();
    window.mathJaxControlsManager.initialize();
    console.log("✅ MathJax Controls Manager initialized");
  } else {
    console.warn("⚠️ MathJaxControlsManager not available for initialization");
  }

  // Initialize Focus Tracking (if available)
  if (typeof FocusTracker !== "undefined") {
    window.focusTracker = FocusTracker;
    console.log("✅ Focus Tracker available");
  }

  console.log("🚀 All accessibility components initialized");
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeAllComponents);
} else {
  initializeAllComponents();
}
