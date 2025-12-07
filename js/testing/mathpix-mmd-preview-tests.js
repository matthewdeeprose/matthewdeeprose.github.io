/**
 * @fileoverview MathPix MMD Preview Test Suite
 * @module MathPixMMDPreviewTests
 * @version 1.0.0
 *
 * Comprehensive testing for the MMD Preview System (Phase 4.0)
 * Covers: CDN loading, rendering, view switching, accessibility, styling
 */

const MMDPreviewTests = {
  // Test categories
  categories: [
    "config",
    "loader",
    "dom",
    "view",
    "render",
    "state",
    "a11y",
    "css",
  ],

  // Sample MMD content for testing
  testContent: {
    simple: "# Test Heading\n\nSimple paragraph.",

    inlineMath: "Here is inline math: $E = mc^2$ in a sentence.",

    displayMath: `# Quadratic Formula

$$
x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$
`,

    complex: `# Complex Document

## Equations

Inline: $\\vec{F} = m\\vec{a}$

Display:
$$
\\int_0^\\infty \\frac{x^3}{e^x-1}\\,dx = \\frac{\\pi^4}{15}
$$

## Table

| Variable | Value |
|----------|-------|
| $x$      | 5     |
| $y$      | 10    |

## Code

\`\`\`python
def quadratic(a, b, c):
    return (-b + sqrt(b**2 - 4*a*c)) / (2*a)
\`\`\`
`,
  },

  /**
   * Run all tests
   */
  async runAll() {
    console.log("🧪 MMD Preview Complete Test Suite");
    console.log("===================================\n");

    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      errors: [],
      categories: {},
    };

    for (const category of this.categories) {
      const categoryResults = await this.runCategory(category);
      results.total += categoryResults.total;
      results.passed += categoryResults.passed;
      results.failed += categoryResults.failed;
      results.errors.push(...categoryResults.errors);
      results.categories[category] = categoryResults;
    }

    console.log("\n===================================");
    console.log(`📊 TOTAL: ${results.passed}/${results.total} passed`);

    if (results.failed > 0) {
      console.log(`❌ ${results.failed} tests failed`);
      results.errors.forEach((e) => console.error("  -", e));
    } else {
      console.log("✅ All tests passed!");
    }

    return results;
  },

  /**
   * Run tests for a specific category
   */
  async runCategory(category) {
    console.log(`\n📁 ${category.toUpperCase()} Tests`);
    console.log("-".repeat(35));

    const testMethod = this[`${category}Tests`];
    if (!testMethod) {
      console.warn(`No tests found for category: ${category}`);
      return { total: 0, passed: 0, failed: 0, errors: [] };
    }

    return await testMethod.call(this);
  },

  /**
   * Helper: Run a single test
   */
  _test(results, name, condition) {
    results.total++;
    if (condition) {
      results.passed++;
      console.log(`  ✅ ${name}`);
    } else {
      results.failed++;
      results.errors.push(name);
      console.log(`  ❌ ${name}`);
    }
  },

  /**
   * Configuration Tests
   */
  async configTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const config = window.MATHPIX_CONFIG?.MMD_PREVIEW;

    test("Config exists", !!config);
    test("CDN URL defined", typeof config?.CDN?.URL === "string");
    test("CDN version defined", typeof config?.CDN?.VERSION === "string");
    test("Load timeout defined", typeof config?.CDN?.LOAD_TIMEOUT === "number");
    test("View modes defined", !!config?.VIEW_MODES);
    test("Feature flags defined", !!config?.FEATURES);
    test("Messages defined", !!config?.MESSAGES);
    test("ARIA labels defined", !!config?.ARIA);
    test("Load states defined", !!config?.LOAD_STATES);

    return results;
  },

  /**
   * CDN Loader Tests
   */
  async loaderTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const preview = window.getMathPixMMDPreview?.();

    test("Preview module exists", !!preview);
    if (!preview) return results;

    test(
      "getLoadState() returns string",
      typeof preview.getLoadState() === "string"
    );
    test("isReady() returns boolean", typeof preview.isReady() === "boolean");

    // Test loading if not already loaded
    if (!preview.isReady()) {
      console.log("  📦 Loading library...");
      try {
        await preview.loadLibrary();
        test("Library loads successfully", preview.isReady());
      } catch (e) {
        test("Library loads successfully", false);
      }
    } else {
      test("Library already loaded", true);
    }

    test(
      "markdownToHTML available",
      typeof window.markdownToHTML === "function"
    );
    test("loadMathJax available", typeof window.loadMathJax === "function");

    return results;
  },

  /**
   * DOM Element Tests
   */
  async domTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const elements = {
      codeBtn: document.getElementById("mmd-view-code-btn"),
      previewBtn: document.getElementById("mmd-view-preview-btn"),
      viewStatus: document.getElementById("mmd-view-status"),
      contentArea: document.getElementById("mmd-content-area"),
      codeContainer: document.getElementById("mmd-code-container"),
      previewContainer: document.getElementById("mmd-preview-container"),
      previewLoading: document.getElementById("mmd-preview-loading"),
      previewError: document.getElementById("mmd-preview-error"),
      previewContent: document.getElementById("mmd-preview-content"),
      codeElement: document.getElementById("mathpix-pdf-content-mmd"),
      retryBtn: document.getElementById("mmd-preview-retry-btn"),
    };

    Object.entries(elements).forEach(([name, el]) => {
      test(`Element: ${name}`, !!el);
    });

    return results;
  },

  /**
   * View Switching Tests
   */
  async viewTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const preview = window.getMathPixMMDPreview?.();
    if (!preview) {
      test("Preview module available", false);
      return results;
    }

    preview.init();

    // Set test content
    preview.setContent(this.testContent.simple);

    // Test code view
    await preview.switchView("code");
    test("Switch to code: state updated", preview.getCurrentView() === "code");
    test(
      "Switch to code: container visible",
      !document.getElementById("mmd-code-container")?.hidden
    );
    test(
      "Switch to code: preview hidden",
      document.getElementById("mmd-preview-container")?.hidden
    );

    // Test preview view
    await preview.switchView("preview");
    test(
      "Switch to preview: state updated",
      preview.getCurrentView() === "preview"
    );
    test(
      "Switch to preview: container visible",
      !document.getElementById("mmd-preview-container")?.hidden
    );
    test(
      "Switch to preview: code hidden",
      document.getElementById("mmd-code-container")?.hidden
    );

    // Test data attribute
    const contentArea = document.getElementById("mmd-content-area");
    test(
      "Data attribute updates",
      contentArea?.dataset.currentView === "preview"
    );

    // Reset
    await preview.switchView("code");

    return results;
  },

  /**
   * Rendering Tests
   */
  async renderTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const preview = window.getMathPixMMDPreview?.();
    if (!preview || !preview.isReady()) {
      test("Preview ready for render tests", false);
      return results;
    }

    // Test renderToString
    const simpleHtml = preview.renderToString(this.testContent.simple);
    test("Simple content renders", simpleHtml?.length > 0);
    test(
      "Heading rendered",
      simpleHtml?.includes("<h1") || simpleHtml?.includes("Test Heading")
    );

    const mathHtml = preview.renderToString(this.testContent.displayMath);
    test("Math content renders", mathHtml?.length > 0);

    // Test content caching
    preview.setContent(this.testContent.complex);
    await preview.switchView("preview");
    const firstRender = preview.lastRenderedContent;
    await preview.switchView("code");
    await preview.switchView("preview");
    test("Content caching works", preview.lastRenderedContent === firstRender);

    // Reset
    await preview.switchView("code");

    return results;
  },

  /**
   * State Management Tests
   */
  async stateTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const preview = window.getMathPixMMDPreview?.();
    if (!preview) {
      test("Preview module available", false);
      return results;
    }

    preview.init();

    const loading = document.getElementById("mmd-preview-loading");
    const error = document.getElementById("mmd-preview-error");
    const content = document.getElementById("mmd-preview-content");

    // Test loading state
    preview.showPreviewState("loading");
    test("Loading state shows", !loading?.hidden);
    test("Error hidden in loading", error?.hidden);
    test("Content hidden in loading", content?.hidden);

    // Test error state
    preview.showPreviewState("error");
    test("Error state shows", !error?.hidden);
    test("Loading hidden in error", loading?.hidden);

    // Test content state
    preview.showPreviewState("content");
    test("Content state shows", !content?.hidden);
    test("Loading hidden in content", loading?.hidden);
    test("Error hidden in content", error?.hidden);

    return results;
  },

  /**
   * Accessibility Tests
   */
  async a11yTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const toggle = document.querySelector(".mmd-view-toggle");
    const codeBtn = document.getElementById("mmd-view-code-btn");
    const previewBtn = document.getElementById("mmd-view-preview-btn");
    const loading = document.getElementById("mmd-preview-loading");
    const error = document.getElementById("mmd-preview-error");
    const content = document.getElementById("mmd-preview-content");
    const status = document.getElementById("mmd-view-status");

    test('Toggle has role="group"', toggle?.getAttribute("role") === "group");
    test("Toggle has aria-label", !!toggle?.getAttribute("aria-label"));
    test("Code btn has aria-pressed", codeBtn?.hasAttribute("aria-pressed"));
    test(
      "Preview btn has aria-pressed",
      previewBtn?.hasAttribute("aria-pressed")
    );
    test(
      'Loading has role="status"',
      loading?.getAttribute("role") === "status"
    );
    test("Loading has aria-live", !!loading?.getAttribute("aria-live"));
    test('Error has role="alert"', error?.getAttribute("role") === "alert");
    test(
      'Content has role="document"',
      content?.getAttribute("role") === "document"
    );
    test("Content has aria-label", !!content?.getAttribute("aria-label"));
    test(
      "Status has aria-live",
      status?.getAttribute("aria-live") === "polite"
    );

    // Test keyboard accessibility (buttons are focusable by default)
    test("Code btn is focusable", codeBtn?.tabIndex !== -1);
    test("Preview btn is focusable", previewBtn?.tabIndex !== -1);

    return results;
  },

  /**
   * CSS Tests
   */
  async cssTests() {
    const results = { total: 0, passed: 0, failed: 0, errors: [] };
    const test = (name, cond) => this._test(results, name, cond);

    const controls = document.querySelector(".mmd-view-controls");
    const toggle = document.querySelector(".mmd-view-toggle");
    const contentArea = document.getElementById("mmd-content-area");
    const spinner = document.querySelector(".mmd-loading-spinner");

    // Check elements have expected styles applied
    if (controls) {
      const style = getComputedStyle(controls);
      test("Controls has flex display", style.display === "flex");
    } else {
      test("Controls element exists", false);
    }

    if (toggle) {
      const style = getComputedStyle(toggle);
      test("Toggle has flex display", style.display === "flex");
    } else {
      test("Toggle element exists", false);
    }

    if (contentArea) {
      const style = getComputedStyle(contentArea);
      test("Content area has flex display", style.display === "flex");
    } else {
      test("Content area element exists", false);
    }

    // Check spinner animation exists
    test("Spinner element exists", !!spinner);
    if (spinner) {
      const style = getComputedStyle(spinner);
      test("Spinner has border-radius", style.borderRadius !== "0px");
    }

    return results;
  },
};

// ============================================================
// Global Test Functions
// ============================================================

if (typeof window !== "undefined") {
  // Main test runner
  window.MMDPreviewTests = MMDPreviewTests;
  window.runMMDPreviewTests = () => MMDPreviewTests.runAll();

  // Individual category runners
  window.testMMDPreviewConfig = () => MMDPreviewTests.runCategory("config");
  window.testMMDPreviewLoader = () => MMDPreviewTests.runCategory("loader");
  window.testMMDPreviewDOM = () => MMDPreviewTests.runCategory("dom");
  window.testMMDPreviewView = () => MMDPreviewTests.runCategory("view");
  window.testMMDPreviewRender = () => MMDPreviewTests.runCategory("render");
  window.testMMDPreviewState = () => MMDPreviewTests.runCategory("state");
  window.testMMDPreviewA11y = () => MMDPreviewTests.runCategory("a11y");
  window.testMMDPreviewCSS = () => MMDPreviewTests.runCategory("css");

  // Quick visual demo
  window.demoMMDPreview = async () => {
    console.log("🎬 MMD Preview Demo");
    console.log("===================\n");

    const preview = window.getMathPixMMDPreview?.();
    if (!preview) {
      console.error("Preview module not available");
      return;
    }

    preview.init();

    const content = MMDPreviewTests.testContent.complex;
    preview.setContent(content);

    console.log("1. Setting complex test content...");
    console.log("2. Switching to preview (watch the UI)...");

    await preview.switchView("preview");

    await new Promise((r) => setTimeout(r, 2000));

    console.log("3. Switching back to code...");
    await preview.switchView("code");

    await new Promise((r) => setTimeout(r, 1000));

    console.log("4. Switching to preview again (cached)...");
    await preview.switchView("preview");

    console.log("\n✅ Demo complete!");
  };

  // Validation aggregate (combines all stage validations)
  window.validateMMDPreviewComplete = async () => {
    console.log("🔍 Complete MMD Preview Validation");
    console.log("==================================\n");

    const results = await MMDPreviewTests.runAll();

    console.log("\n==================================");
    if (results.failed === 0) {
      console.log("🎉 MMD PREVIEW SYSTEM FULLY VALIDATED");
    } else {
      console.log("⚠️  Some tests failed - review above");
    }

    return results;
  };
}
