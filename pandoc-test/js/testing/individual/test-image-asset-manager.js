// test-image-asset-manager.js
// Tests for ImageAssetManager module
// Run sync tests: testImageAssetManager()
// Run async tests: await testImageAssetManagerAsync()

const TestImageAssetManager = (function () {
  "use strict";

  function testImageAssetManager() {
    const tests = {
      // ---------------------------------------------------------------
      // Module existence and API
      // ---------------------------------------------------------------
      moduleExists: () => !!window.ImageAssetManager,

      hasDetectionMethods: () =>
        typeof window.ImageAssetManager.detectImageReferences === "function" &&
        typeof window.ImageAssetManager.getMissingImages === "function" &&
        typeof window.ImageAssetManager.allImagesAvailable === "function" &&
        typeof window.ImageAssetManager.extractCaptionForImage === "function",

      hasAnnotationMethods: () =>
        typeof window.ImageAssetManager.parseAnnotations === "function" &&
        typeof window.ImageAssetManager.getEffectiveAltText === "function" &&
        typeof window.ImageAssetManager.getAccessibilityReport === "function",

      hasRegistrationMethods: () =>
        typeof window.ImageAssetManager.registerImage === "function" &&
        typeof window.ImageAssetManager.promptForMissingImages === "function",

      hasReplacementMethods: () =>
        typeof window.ImageAssetManager.replaceImagesForPreview ===
          "function" &&
        typeof window.ImageAssetManager.replaceImagesForExport === "function",

      hasRegistryMethods: () =>
        typeof window.ImageAssetManager.getRegistryInfo === "function" &&
        typeof window.ImageAssetManager.getImageCount === "function" &&
        typeof window.ImageAssetManager.hasImage === "function" &&
        typeof window.ImageAssetManager.getImage === "function" &&
        typeof window.ImageAssetManager.clearRegistry === "function" &&
        typeof window.ImageAssetManager.removeImage === "function",

      // ---------------------------------------------------------------
      // Basic detection tests
      // ---------------------------------------------------------------
      detectsSingleImage: () => {
        const refs = window.ImageAssetManager.detectImageReferences(
          String.raw`\includegraphics[width=7cm]{yoda.jpg}`
        );
        return refs.length === 1 && refs[0].filename === "yoda.jpg";
      },

      detectsMultipleImages: () => {
        const latex = String.raw`
\includegraphics{img1.png}
\includegraphics[scale=0.5]{dir/img2.jpg}
        `;
        const refs =
          window.ImageAssetManager.detectImageReferences(latex);
        return refs.length === 2;
      },

      detectsNoImagesInMathOnly: () => {
        const refs = window.ImageAssetManager.detectImageReferences(
          String.raw`$x^2 + y^2 = z^2$`
        );
        return refs.length === 0;
      },

      handlesNullInput: () => {
        const refs = window.ImageAssetManager.detectImageReferences(null);
        return refs.length === 0;
      },

      // ---------------------------------------------------------------
      // Annotation parsing — @alt
      // ---------------------------------------------------------------
      parsesAltAnnotation: () => {
        const latex =
          "% @alt: A rocky coastline with waves\n\\includegraphics{coast.jpg}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs.length === 1 &&
          refs[0].altText === "A rocky coastline with waves" &&
          refs[0].isDecorative === false
        );
      },

      parsesAltCaseInsensitive: () => {
        const latex =
          "% @Alt: Some description\n\\includegraphics{img.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return refs[0].altText === "Some description";
      },

      // ---------------------------------------------------------------
      // Annotation parsing — @decorative
      // ---------------------------------------------------------------
      parsesDecorativeAnnotation: () => {
        const latex =
          "% @decorative\n\\includegraphics{border.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs.length === 1 &&
          refs[0].isDecorative === true &&
          refs[0].altText === null
        );
      },

      // ---------------------------------------------------------------
      // Annotation parsing — @longdesc (single line)
      // ---------------------------------------------------------------
      parsesLongDescSingleLine: () => {
        const latex =
          "% @alt: A bar chart\n" +
          "% @longdesc: The chart shows three bars representing sales.\n" +
          "\\includegraphics{chart.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs[0].altText === "A bar chart" &&
          refs[0].longDescription === "The chart shows three bars representing sales."
        );
      },

      // ---------------------------------------------------------------
      // Annotation parsing — @longdesc (multi-line)
      // ---------------------------------------------------------------
      parsesLongDescMultiLine: () => {
        const latex =
          "% @alt: A complex diagram\n" +
          "% @longdesc: First part of the description.\n" +
          "% @longdesc: Second part of the description.\n" +
          "% @longdesc: Third part of the description.\n" +
          "\\includegraphics{diagram.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs[0].longDescription ===
          "First part of the description. Second part of the description. Third part of the description."
        );
      },

      // ---------------------------------------------------------------
      // Annotation parsing — no annotations (fallback to caption)
      // ---------------------------------------------------------------
      fallsBackToCaption: () => {
        const latex = String.raw`
\begin{figure}[h]
\centering
\includegraphics[width=7cm]{yoda.jpg}
\caption{A Yoda statue.}
\end{figure}
        `;
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs[0].altText === null &&
          refs[0].captionText === "A Yoda statue." &&
          refs[0].accessibilityStatus.level === "fallback"
        );
      },

      // ---------------------------------------------------------------
      // Annotation parsing — no annotations, no caption
      // ---------------------------------------------------------------
      detectsPoorAccessibility: () => {
        const latex = "\\includegraphics{orphan.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return (
          refs[0].altText === null &&
          refs[0].captionText === null &&
          refs[0].accessibilityStatus.level === "poor"
        );
      },

      // ---------------------------------------------------------------
      // Effective alt text logic
      // ---------------------------------------------------------------
      effectiveAltDecorativeIsEmpty: () => {
        const ref = { altText: null, isDecorative: true, captionText: "Label" };
        return window.ImageAssetManager.getEffectiveAltText(ref) === "";
      },

      effectiveAltPrefersExplicit: () => {
        const ref = { altText: "Visual desc", isDecorative: false, captionText: "Caption" };
        return window.ImageAssetManager.getEffectiveAltText(ref) === "Visual desc";
      },

      effectiveAltFallsBackToCaption: () => {
        const ref = { altText: null, isDecorative: false, captionText: "Caption" };
        return window.ImageAssetManager.getEffectiveAltText(ref) === "Caption";
      },

      effectiveAltDefaultsToImage: () => {
        const ref = { altText: null, isDecorative: false, captionText: null };
        return window.ImageAssetManager.getEffectiveAltText(ref) === "image";
      },

      // ---------------------------------------------------------------
      // Accessibility report
      // ---------------------------------------------------------------
accessibilityReportWarnsOnDuplicateAltCaption: () => {
        const latex =
          "\\begin{figure}[h]\n" +
          "% @alt: A Yoda statue.\n" +
          "\\includegraphics{yoda.jpg}\n\\caption{A Yoda statue.}\n\\end{figure}";
        const report = window.ImageAssetManager.getAccessibilityReport(latex);
        return (
          report[0].warnings.length > 0 &&
          report[0].warnings[0].includes("identical to the caption")
        );
      },

      accessibilityReportDecorativeIsOptimal: () => {
        const latex =
          "% @decorative\n\\includegraphics{border.png}";
        const report = window.ImageAssetManager.getAccessibilityReport(latex);
        return report[0].level === "optimal";
      },

      // ---------------------------------------------------------------
      // Annotations stop at non-comment lines
      // ---------------------------------------------------------------
      annotationsStopAtNonComment: () => {
        const latex =
          "% @alt: This should NOT be picked up\n" +
          "Some regular text\n" +
          "\\includegraphics{img.png}";
        const refs = window.ImageAssetManager.detectImageReferences(latex);
        return refs[0].altText === null;
      },

      // ---------------------------------------------------------------
      // Missing images detection
      // ---------------------------------------------------------------
      detectsMissingImages: () => {
        window.ImageAssetManager.clearRegistry();
        const latex = "\\includegraphics{test.png}";
        const missing = window.ImageAssetManager.getMissingImages(latex);
        return missing.length === 1 && missing[0].filename === "test.png";
      },

      allImagesAvailableWhenNone: () => {
        const latex = String.raw`$x^2$`;
        return window.ImageAssetManager.allImagesAvailable(latex) === true;
      },

      // ---------------------------------------------------------------
      // Registry management
      // ---------------------------------------------------------------
      registryStartsEmpty: () => {
        window.ImageAssetManager.clearRegistry();
        return window.ImageAssetManager.getImageCount() === 0;
      },

      clearRegistryWorks: () => {
        window.ImageAssetManager.clearRegistry();
        return (
          window.ImageAssetManager.getImageCount() === 0 &&
          Object.keys(window.ImageAssetManager.getRegistryInfo()).length === 0
        );
      },

      registrationAPIExists: () =>
        typeof window.ImageAssetManager.registerImage === "function",

      // ---------------------------------------------------------------
      // Preview/export no-op when empty
      // ---------------------------------------------------------------
      previewReplacementNoOpWhenEmpty: () => {
        window.ImageAssetManager.clearRegistry();
        const container = document.createElement("div");
        container.innerHTML = '<img src="missing.png" alt="image" />';
        const count =
          window.ImageAssetManager.replaceImagesForPreview(container);
        return (
          count === 0 &&
          container.querySelector("img").getAttribute("src") === "missing.png"
        );
      },

      exportReplacementNoOpWhenEmpty: () => {
        window.ImageAssetManager.clearRegistry();
        const html = '<img src="missing.png" alt="image" />';
        const result =
          window.ImageAssetManager.replaceImagesForExport(html);
        return result.includes('src="missing.png"');
      },

      removeNonExistentReturnsFalse: () => {
        window.ImageAssetManager.clearRegistry();
        return (
          window.ImageAssetManager.removeImage("no-such-file.png") === false
        );
      },

      // ---------------------------------------------------------------
      // Integration readiness
      // ---------------------------------------------------------------
      integrationReadiness: () => {
        window.ImageAssetManager.clearRegistry();
        const emptyPreview =
          window.ImageAssetManager.replaceImagesForPreview(
            document.createElement("div")
          );
        const emptyExport =
          window.ImageAssetManager.replaceImagesForExport("<p>Hello</p>");
        return emptyPreview === 0 && emptyExport === "<p>Hello</p>";
      },
    };

    return TestUtilities.runTestSuite("ImageAssetManager", tests);
  }

  return { testImageAssetManager };
})();

/**
 * Async tests that require image registration (cannot run in runTestSuite)
 * Run via: await testImageAssetManagerAsync()
 */
async function testImageAssetManagerAsync() {
  console.log("\n🧪 Running ImageAssetManager Async Tests:");
  console.log("==================================================");

  const results = [];

  function log(name, passed, detail) {
    const icon = passed ? "✅" : "❌";
    console.log(
      `${icon} ${name}: ${passed ? "PASSED" : "FAILED"}${detail ? " — " + detail : ""}`
    );
    results.push({ name, passed });
  }

  // Setup: create a synthetic image file
  window.ImageAssetManager.clearRegistry();
  const canvas = document.createElement("canvas");
  canvas.width = 100;
  canvas.height = 100;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#cc0000";
  ctx.fillRect(0, 0, 100, 100);

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/png")
  );
  const file = new File([blob], "test-image.png", { type: "image/png" });

  // TEST: registerImage
  try {
    const result = await window.ImageAssetManager.registerImage(
      "test-image.png",
      file
    );
    log(
      "registerImageWorks",
      result.width === 100 &&
        result.height === 100 &&
        !!result.objectUrl &&
        !!result.base64DataUrl &&
        window.ImageAssetManager.hasImage("test-image.png"),
      `${result.width}×${result.height}, format: ${result.format}`
    );
  } catch (error) {
    log("registerImageWorks", false, error.message);
  }

  // TEST: previewReplacement with accessibility attributes
  {
    const container = document.createElement("div");
    container.innerHTML = '<img src="test-image.png" alt="image" />';

    const count =
      window.ImageAssetManager.replaceImagesForPreview(container);
    const img = container.querySelector("img");

    log(
      "previewReplacementWorks",
      count === 1 &&
        img.src.startsWith("blob:") &&
        img.getAttribute("data-image-asset") === "true" &&
        img.getAttribute("data-original-src") === "test-image.png",
      `Replaced ${count} image(s), src starts with: ${img.src.substring(0, 20)}...`
    );
  }

  // TEST: exportReplacement
  {
    const html = '<img src="test-image.png" alt="image" />';
    const result =
      window.ImageAssetManager.replaceImagesForExport(html);

    log(
      "exportReplacementWorks",
      result.includes("data:image/") &&
        result.includes("base64,") &&
        !result.includes('src="test-image.png"'),
      `Contains base64: ${result.includes("base64,")}, original src removed: ${!result.includes('src="test-image.png"')}`
    );
  }

  // TEST: decorative image attributes in export
  {
    // Manually set decorative flag on registry entry
    const entry = window.ImageAssetManager.getImage("test-image.png");
    if (entry) {
      entry.isDecorative = true;
      entry.altText = null;
    }

    const html = '<img src="test-image.png" alt="image" />';
    const result = window.ImageAssetManager.replaceImagesForExport(html);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = result;
    const img = tempDiv.querySelector("img");

    log(
      "decorativeExportHasEmptyAlt",
      img.getAttribute("alt") === "" &&
        img.getAttribute("role") === "presentation",
      `alt="${img.getAttribute("alt")}", role="${img.getAttribute("role")}"`
    );

    // Reset flags
    if (entry) {
      entry.isDecorative = false;
    }
  }

  // TEST: long description injection in export
  {
    const entry = window.ImageAssetManager.getImage("test-image.png");
    if (entry) {
      entry.altText = "A test chart";
      entry.longDescription = "Detailed description of the test chart data.";
    }

    const html =
      '<figure><img src="test-image.png" alt="image" /><figcaption>Test</figcaption></figure>';
    const result = window.ImageAssetManager.replaceImagesForExport(html);

    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = result;
    const img = tempDiv.querySelector("img");
    const longDescDiv = tempDiv.querySelector(".image-long-description");

    log(
      "longDescriptionInjected",
      !!longDescDiv &&
        longDescDiv.querySelector("p").textContent ===
          "Detailed description of the test chart data." &&
        img.getAttribute("aria-describedby") === longDescDiv.id,
      longDescDiv
        ? `ID: ${longDescDiv.id}, linked: ${img.getAttribute("aria-describedby") === longDescDiv.id}`
        : "Long description element not found"
    );

    // Reset
    if (entry) {
      entry.altText = null;
      entry.longDescription = null;
    }
  }

  // TEST: removeImage
  {
    const removed = window.ImageAssetManager.removeImage("test-image.png");
    log(
      "removeImageWorks",
      removed === true &&
        !window.ImageAssetManager.hasImage("test-image.png"),
      `Removed: ${removed}, still exists: ${window.ImageAssetManager.hasImage("test-image.png")}`
    );
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log("==================================================");
  console.log(
    `Async Results: ${passed}/${results.length} passed, ${failed} failed`
  );

  return { passed, failed, total: results.length, results };
}

// Global shortcuts
window.testImageAssetManager = TestImageAssetManager.testImageAssetManager;
window.testImageAssetManagerAsync = testImageAssetManagerAsync;
