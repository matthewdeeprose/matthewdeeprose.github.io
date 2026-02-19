// test-image-asset-poc.js
// Proof-of-Concept Tests for LaTeX Image Asset Management
// Tests: regex detection, Canvas WebP conversion, base64 encoding, src replacement
// Run via console: TestImageAssetPOC.runAll()

const TestImageAssetPOC = (function () {
  "use strict";

  const results = [];

  function log(testName, passed, detail) {
    const status = passed ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${testName}${detail ? " — " + detail : ""}`);
    results.push({ testName, passed, detail });
  }

  // =========================================================================
  // TEST 1: Can we detect \includegraphics references in LaTeX?
  // =========================================================================
  function testLatexImageDetection() {
    console.log("\n--- TEST 1: LaTeX Image Detection ---");

    // Regex to match \includegraphics[optional]{filename}
    const pattern = /\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g;

    // Test case: the user's actual LaTeX
    const latex = String.raw`
\begin{figure}[h]
\centering
\includegraphics[width=7cm, height=7cm]{yoda.jpg}
\caption{A Yoda statue.}
\label{fig1:yoda1}
\end{figure}
    `;

    const matches = [];
    let match;
    while ((match = pattern.exec(latex)) !== null) {
      matches.push({
        fullMatch: match[0],
        options: match[1] || null,
        filename: match[2],
      });
    }

    log(
      "Detects includegraphics",
      matches.length === 1,
      `Found ${matches.length} match(es)`
    );

    log(
      "Extracts filename correctly",
      matches[0]?.filename === "yoda.jpg",
      `Got: "${matches[0]?.filename}"`
    );

    log(
      "Extracts options correctly",
      matches[0]?.options === "width=7cm, height=7cm",
      `Got: "${matches[0]?.options}"`
    );

    // Test multiple images
    const multiLatex = String.raw`
\includegraphics{image1.png}
\includegraphics[scale=0.5]{diagrams/circuit.pdf}
\includegraphics[width=\textwidth]{photo.jpeg}
    `;

    const multiMatches = [];
    pattern.lastIndex = 0; // Reset regex
    while ((match = pattern.exec(multiLatex)) !== null) {
      multiMatches.push(match[2]);
    }

    log(
      "Detects multiple images",
      multiMatches.length === 3,
      `Found ${multiMatches.length}: ${multiMatches.join(", ")}`
    );

    // Test no images
    const noImageLatex = String.raw`\section{Hello} $x^2$`;
    pattern.lastIndex = 0;
    const noMatches = [...noImageLatex.matchAll(pattern)];

    log(
      "Returns empty for no images",
      noMatches.length === 0,
      `Found ${noMatches.length}`
    );

    return matches;
  }

  // =========================================================================
  // TEST 2: Can we convert images to WebP using Canvas API?
  // =========================================================================
  async function testWebPConversion() {
    console.log("\n--- TEST 2: WebP Conversion via Canvas API ---");

    // Check Canvas API availability
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    log(
      "Canvas API available",
      !!canvas && !!ctx,
      `canvas: ${!!canvas}, context: ${!!ctx}`
    );

    // Check WebP support via toDataURL
    canvas.width = 10;
    canvas.height = 10;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 10, 10);

    const webpDataUrl = canvas.toDataURL("image/webp", 0.85);
    const supportsWebP = webpDataUrl.startsWith("data:image/webp");

    log(
      "Browser supports WebP encoding",
      supportsWebP,
      supportsWebP
        ? "toDataURL returns image/webp"
        : "Falls back to PNG — will use PNG instead"
    );

    // Test creating a synthetic image and converting it
    const testCanvas = document.createElement("canvas");
    testCanvas.width = 100;
    testCanvas.height = 100;
    const testCtx = testCanvas.getContext("2d");

    // Draw something recognisable
    testCtx.fillStyle = "#0066cc";
    testCtx.fillRect(0, 0, 100, 100);
    testCtx.fillStyle = "#ffffff";
    testCtx.font = "16px sans-serif";
    testCtx.fillText("Test", 30, 55);

    const format = supportsWebP ? "image/webp" : "image/png";
    const dataUrl = testCanvas.toDataURL(format, 0.85);

    log(
      "Canvas produces valid data URL",
      dataUrl.startsWith("data:image/"),
      `Format: ${format}, Length: ${dataUrl.length} chars`
    );

    // Extract just the base64 portion
    const base64Part = dataUrl.split(",")[1];
    log(
      "Base64 extraction works",
      base64Part && base64Part.length > 0,
      `Base64 length: ${base64Part?.length || 0} chars`
    );

    return { supportsWebP, format, dataUrlLength: dataUrl.length };
  }

  // =========================================================================
  // TEST 3: Can we load an image from a File object into Canvas?
  // =========================================================================
  async function testFileToCanvas() {
    console.log("\n--- TEST 3: File → Image → Canvas Pipeline ---");

    // Create a synthetic blob (simulating a user-uploaded file)
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#00cc66";
    ctx.fillRect(0, 0, 50, 50);

    // Convert canvas to blob (simulates a real image file)
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png")
    );

    log(
      "Can create image blob",
      blob instanceof Blob,
      `Blob size: ${blob.size} bytes, type: ${blob.type}`
    );

    // Test loading blob into an Image element (as we would with a user file)
    const objectUrl = URL.createObjectURL(blob);
    log(
      "Object URL created",
      objectUrl.startsWith("blob:"),
      `URL: ${objectUrl.substring(0, 40)}...`
    );

    // Load image from object URL
    const img = new Image();
    const loadResult = await new Promise((resolve) => {
      img.onload = () =>
        resolve({ loaded: true, width: img.width, height: img.height });
      img.onerror = () => resolve({ loaded: false });
      img.src = objectUrl;
    });

    log(
      "Image loads from Object URL",
      loadResult.loaded,
      loadResult.loaded
        ? `${loadResult.width}x${loadResult.height}`
        : "Failed to load"
    );

    // Convert to WebP via canvas
    if (loadResult.loaded) {
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = img.width;
      exportCanvas.height = img.height;
      const exportCtx = exportCanvas.getContext("2d");
      exportCtx.drawImage(img, 0, 0);

      const webpUrl = exportCanvas.toDataURL("image/webp", 0.85);
      const pngUrl = exportCanvas.toDataURL("image/png");

      const webpBase64 = webpUrl.split(",")[1];
      const pngBase64 = pngUrl.split(",")[1];

      const savingsPercent =
        pngBase64.length > 0
          ? (
              ((pngBase64.length - webpBase64.length) / pngBase64.length) *
              100
            ).toFixed(1)
          : "N/A";

      log(
        "WebP conversion produces smaller output",
        webpBase64.length <= pngBase64.length,
        `PNG: ${pngBase64.length} chars, WebP: ${webpBase64.length} chars (${savingsPercent}% savings)`
      );
    }

    // Clean up
    URL.revokeObjectURL(objectUrl);

    return loadResult;
  }

  // =========================================================================
  // TEST 4: Can we replace img src attributes in HTML strings?
  // =========================================================================
  function testSrcReplacement() {
    console.log("\n--- TEST 4: HTML Image src Replacement ---");

    // Simulate Pandoc output with image references
    const pandocHTML = `
<figure>
<img src="yoda.jpg" style="width:7cm;height:7cm" alt="image" />
<figcaption>A Yoda statue.</figcaption>
</figure>
    `.trim();

    // Simulate our image registry
    const imageRegistry = new Map();
    imageRegistry.set("yoda.jpg", {
      objectUrl: "blob:http://localhost/fake-blob-url",
      base64DataUrl: "data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdA",
      altText: "A Yoda statue.",
    });

    // Test: Replace src for preview (using Object URLs)
    let previewHTML = pandocHTML;
    imageRegistry.forEach((data, filename) => {
      // Escape filename for regex safety
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const srcRegex = new RegExp(
        `(<img[^>]*\\ssrc=["'])${escaped}(["'])`,
        "g"
      );
      previewHTML = previewHTML.replace(srcRegex, `$1${data.objectUrl}$2`);
    });

    log(
      "Preview src replacement works",
      previewHTML.includes("blob:http://localhost/fake-blob-url"),
      "Object URL injected into src"
    );

    log(
      "Original filename removed from preview",
      !previewHTML.includes('src="yoda.jpg"'),
      "No raw filename in src"
    );

    // Test: Replace src for export (using base64 data URLs)
    let exportHTML = pandocHTML;
    imageRegistry.forEach((data, filename) => {
      const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const srcRegex = new RegExp(
        `(<img[^>]*\\ssrc=["'])${escaped}(["'])`,
        "g"
      );
      exportHTML = exportHTML.replace(srcRegex, `$1${data.base64DataUrl}$2`);
    });

    log(
      "Export src replacement works",
      exportHTML.includes("data:image/webp;base64,"),
      "Base64 data URL injected into src"
    );

    // Test: DOM-based replacement (more robust for preview)
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = pandocHTML;
    const imgs = tempDiv.querySelectorAll("img");

    let domReplacementCount = 0;
    imgs.forEach((img) => {
      const src = img.getAttribute("src");
      if (imageRegistry.has(src)) {
        img.setAttribute("src", imageRegistry.get(src).objectUrl);
        domReplacementCount++;
      }
    });

    log(
      "DOM-based replacement works",
      domReplacementCount === 1,
      `Replaced ${domReplacementCount} image(s) via DOM`
    );

    // Test with subdirectory paths
    const subDirHTML = '<img src="diagrams/circuit.png" alt="Circuit" />';
    const subDirRegistry = new Map();
    subDirRegistry.set("diagrams/circuit.png", {
      objectUrl: "blob:http://localhost/circuit-blob",
    });

    const subDiv = document.createElement("div");
    subDiv.innerHTML = subDirHTML;
    const subImgs = subDiv.querySelectorAll("img");
    subImgs.forEach((img) => {
      const src = img.getAttribute("src");
      if (subDirRegistry.has(src)) {
        img.setAttribute("src", subDirRegistry.get(src).objectUrl);
      }
    });

    log(
      "Subdirectory paths handled",
      subDiv.querySelector("img").src.includes("circuit-blob"),
      "Path with directory separator works"
    );

    return true;
  }

  // =========================================================================
  // TEST 5: Can we add alt text from LaTeX captions?
  // =========================================================================
  function testAltTextExtraction() {
    console.log("\n--- TEST 5: Alt Text Extraction from LaTeX ---");

    const latex = String.raw`
\begin{figure}[h]
\centering
\includegraphics[width=7cm, height=7cm]{yoda.jpg}
\caption{A Yoda statue.}
\label{fig1:yoda1}
Figure \ref{fig1:yoda1} shows a statue of the Star Wars character Yoda in a forest.
\end{figure}
    `;

    // Strategy: Find figure environments containing includegraphics,
    // then extract the caption text
    const figurePattern =
      /\\begin\{figure\}[\s\S]*?\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}[\s\S]*?\\caption\{([^}]+)\}[\s\S]*?\\end\{figure\}/g;

    const figMatch = figurePattern.exec(latex);

    log(
      "Finds figure environment",
      figMatch !== null,
      figMatch ? "Figure environment detected" : "Not found"
    );

    if (figMatch) {
      log(
        "Extracts filename from figure",
        figMatch[2] === "yoda.jpg",
        `Got: "${figMatch[2]}"`
      );

      log(
        "Extracts caption for alt text",
        figMatch[3] === "A Yoda statue.",
        `Got: "${figMatch[3]}"`
      );
    }

    // Also look for descriptive text after the figure reference
    // This is the accessibility best practice mentioned in the LaTeX doc
    const descPattern =
      /Figure\s+\\ref\{[^}]+\}\s+(.*?)(?:\n|\\end\{figure\})/;
    const descMatch = descPattern.exec(latex);

    log(
      "Extracts figure description",
      descMatch !== null && descMatch[1].includes("Yoda"),
      descMatch ? `Got: "${descMatch[1].trim()}"` : "Not found"
    );

    return figMatch;
  }

  // =========================================================================
  // RUN ALL TESTS
  // =========================================================================
  async function runAll() {
    console.log("=".repeat(60));
    console.log("IMAGE ASSET MANAGEMENT - PROOF OF CONCEPT TESTS");
    console.log("=".repeat(60));

    results.length = 0;

    testLatexImageDetection();
    await testWebPConversion();
    await testFileToCanvas();
    testSrcReplacement();
    testAltTextExtraction();

    // Summary
    const passed = results.filter((r) => r.passed).length;
    const failed = results.filter((r) => !r.passed).length;
    const total = results.length;

    console.log("\n" + "=".repeat(60));
    console.log(`RESULTS: ${passed}/${total} passed, ${failed} failed`);
    console.log("=".repeat(60));

    if (failed === 0) {
      console.log(
        "✅ All proof-of-concept tests passed — safe to proceed with implementation"
      );
    } else {
      console.warn(
        "⚠️ Some tests failed — review before proceeding"
      );
      results
        .filter((r) => !r.passed)
        .forEach((r) => console.warn(`  ❌ ${r.testName}: ${r.detail}`));
    }

    return { passed, failed, total, results };
  }

  return { runAll };
})();

window.TestImageAssetPOC = TestImageAssetPOC;