// image-asset-manager.js
// Image Asset Manager - Handles LaTeX \includegraphics image upload, storage, and embedding
// Manages image registry, WebP conversion, preview URL injection, and export base64 embedding
// Supports @alt, @decorative, and @longdesc annotations for WCAG 2.2 AA compliance
// Part of Enhanced Pandoc-WASM Mathematical Playground

const ImageAssetManager = (function () {
  "use strict";

  // ===========================================================================================
  // LOGGING CONFIGURATION (IIFE SCOPE)
  // ===========================================================================================

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
      console.error("[IMAGE-ASSET]", message, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn("[IMAGE-ASSET]", message, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log("[IMAGE-ASSET]", message, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log("[IMAGE-ASSET]", message, ...args);
  }

  // ===========================================================================================
  // IMAGE REGISTRY
  // ===========================================================================================

  /**
   * Registry mapping filenames to image data
   * Key: filename as referenced in LaTeX (e.g., "yoda.jpg", "diagrams/circuit.png")
   * Value: { file, objectUrl, base64DataUrl, mimeType, width, height,
   *          altText, isDecorative, longDescription, captionText, size }
   */
  const imageRegistry = new Map();

  // ===========================================================================================
  // ANNOTATION PARSING
  // ===========================================================================================

  /**
   * Parse accessibility annotations from comment lines preceding an \includegraphics command.
   *
   * Supported annotations:
   *   % @alt: Brief visual description
   *   % @decorative
   *   % @longdesc: Extended description (can span multiple consecutive lines)
   *
   * @param {string} latex - Full LaTeX source
   * @param {number} includegraphicsIndex - Character index where \includegraphics starts
   * @returns {Object} { altText, isDecorative, longDescription }
   */
  function parseAnnotations(latex, includegraphicsIndex) {
    const result = {
      altText: null,
      isDecorative: false,
      longDescription: null,
    };

    // Extract the text before the \includegraphics command
    const textBefore = latex.substring(0, includegraphicsIndex);

    // Split into lines and work backwards from the \includegraphics line
    const lines = textBefore.split("\n");

    // Collect annotation lines (working backwards from end, stopping at first non-comment/non-blank)
    const annotationLines = [];
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();

      // Skip blank lines between annotations and \includegraphics
      if (trimmed === "") {
        continue;
      }

      // Check if this is a comment line with an annotation
      if (trimmed.startsWith("%")) {
        annotationLines.unshift(trimmed);
      } else {
        // Hit a non-comment line — stop looking
        break;
      }
    }

    // Parse collected annotation lines
    const longDescParts = [];

    for (const line of annotationLines) {
      // Remove the leading % and trim
      const content = line.replace(/^%\s*/, "").trim();

      if (/^@decorative\s*$/i.test(content)) {
        result.isDecorative = true;
        logDebug("Found @decorative annotation");
      } else if (/^@alt:\s*/i.test(content)) {
        result.altText = content.replace(/^@alt:\s*/i, "").trim();
        logDebug(`Found @alt annotation: "${result.altText}"`);
      } else if (/^@longdesc:\s*/i.test(content)) {
        const descPart = content.replace(/^@longdesc:\s*/i, "").trim();
        if (descPart) {
          longDescParts.push(descPart);
        }
      }
    }

    // Concatenate multi-line long descriptions
    if (longDescParts.length > 0) {
      result.longDescription = longDescParts.join(" ");
      logDebug(
        `Found @longdesc annotation (${longDescParts.length} line(s)): "${result.longDescription.substring(0, 80)}..."`
      );
    }

    return result;
  }

  // ===========================================================================================
  // LATEX IMAGE DETECTION
  // ===========================================================================================

  /**
   * Detect all \includegraphics references in LaTeX source with annotation parsing
   * @param {string} latex - LaTeX source content
   * @returns {Array<Object>} Array of { filename, options, altText, isDecorative,
   *          longDescription, captionText, accessibilityStatus } objects
   */
  function detectImageReferences(latex) {
    if (!latex || typeof latex !== "string") {
      return [];
    }

    const pattern = /\\includegraphics\s*(?:\[([^\]]*)\])?\s*\{([^}]+)\}/g;
    const references = [];
    let match;

    while ((match = pattern.exec(latex)) !== null) {
      const filename = match[2].trim();
      const options = match[1] || null;
      const matchIndex = match.index;

// Parse @alt, @decorative, @longdesc annotations
      const annotations = parseAnnotations(latex, matchIndex);

      // Extract caption from the specific figure environment at this position (not by filename)
      const captionText = extractCaptionAtPosition(latex, matchIndex);

      // Determine accessibility status
      const accessibilityStatus = assessAccessibility(
        annotations,
        captionText
      );

      references.push({
        filename,
        options,
        altText: annotations.altText,
        isDecorative: annotations.isDecorative,
        longDescription: annotations.longDescription,
        captionText,
        accessibilityStatus,
      });
    }

    logDebug(`Detected ${references.length} image reference(s) in LaTeX`);
    return references;
  }

/**
   * Extract caption text from \caption{} within the same figure environment.
   * LEGACY: Searches by filename — finds the FIRST figure environment containing
   * that filename. Kept for backward compatibility with public API.
   * For per-occurrence accuracy, use extractCaptionAtPosition() instead.
   * @param {string} latex - Full LaTeX source
   * @param {string} filename - Image filename to find caption for
   * @returns {string|null} Caption text or null
   */
  function extractCaptionForImage(latex, filename) {
    const escapedFilename = filename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const figurePattern = new RegExp(
      "\\\\begin\\{figure\\}[\\s\\S]*?" +
        escapedFilename +
        "[\\s\\S]*?\\\\caption\\{([^}]+)\\}" +
        "[\\s\\S]*?\\\\end\\{figure\\}",
      "g"
    );

    const figMatch = figurePattern.exec(latex);
    if (figMatch && figMatch[1]) {
      logDebug(
        `Found caption for "${filename}": "${figMatch[1].trim()}"`
      );
      return figMatch[1].trim();
    }

    return null;
  }

  /**
   * Extract caption text from the figure environment that contains the
   * \includegraphics at the given character position.
   * Position-aware — correctly handles the same filename in multiple figures.
   *
   * @param {string} latex - Full LaTeX source
   * @param {number} includegraphicsIndex - Character index where \includegraphics starts
   * @returns {string|null} Caption text or null
   */
  function extractCaptionAtPosition(latex, includegraphicsIndex) {
    // Search backward for the nearest \begin{figure} (with optional placement arg)
    const beforeText = latex.substring(0, includegraphicsIndex);
    const figureStartIndex = beforeText.lastIndexOf("\\begin{figure}");

    if (figureStartIndex === -1) {
      // Not inside a figure environment
      return null;
    }

    // Check for a closer \end{figure} between the \begin{figure} and our position
    // — if found, the \begin{figure} we found belongs to an earlier, already-closed figure
    const betweenText = latex.substring(figureStartIndex, includegraphicsIndex);
    if (betweenText.includes("\\end{figure}")) {
      return null;
    }

    // Search forward for the closing \end{figure}
    const afterIndex = latex.indexOf("\\end{figure}", includegraphicsIndex);
    if (afterIndex === -1) {
      return null;
    }

    // Extract the figure environment content
    const figureContent = latex.substring(
      figureStartIndex,
      afterIndex + "\\end{figure}".length
    );

    // Find \caption{...} within this specific figure environment
    const captionMatch = figureContent.match(/\\caption\{([^}]+)\}/);
    if (captionMatch && captionMatch[1]) {
      logDebug(
        `Found caption at position ${includegraphicsIndex}: "${captionMatch[1].trim()}"`
      );
      return captionMatch[1].trim();
    }

    return null;
  }

  /**
   * Assess the accessibility quality of an image's metadata
   * @param {Object} annotations - Parsed annotations { altText, isDecorative, longDescription }
   * @param {string|null} captionText - Caption text from figure environment
   * @returns {Object} { level, message, warnings }
   *   level: "optimal" | "good" | "fallback" | "poor"
   */
  function assessAccessibility(annotations, captionText) {
    const warnings = [];

    // Decorative images — optimal if explicitly marked
    if (annotations.isDecorative) {
      if (annotations.altText) {
        warnings.push(
          "Image marked as @decorative but also has @alt text. The @alt will be ignored — remove it or remove @decorative."
        );
      }
      return { level: "optimal", message: "Decorative image — will use alt=\"\"", warnings };
    }

    // Has explicit @alt — good or optimal
    if (annotations.altText) {
      // Check if alt duplicates caption
      if (captionText && annotations.altText.toLowerCase() === captionText.toLowerCase()) {
        warnings.push(
          "Alt text is identical to the caption. Alt text should describe the visual content; the caption labels the figure. Consider rewriting the @alt to describe what the image shows."
        );
      }

      if (annotations.longDescription) {
        return {
          level: "optimal",
          message: "Has alt text, caption, and long description",
          warnings,
        };
      }

      return { level: "good", message: "Has explicit alt text", warnings };
    }

    // No @alt, but has caption — fallback
    if (captionText) {
      warnings.push(
        "No @alt annotation found — using caption as alt text fallback. Add a % @alt: annotation before \\includegraphics to provide a proper visual description separate from the caption."
      );
      return { level: "fallback", message: "Using caption as alt text fallback", warnings };
    }

    // Nothing at all
    warnings.push(
      "No alt text, caption, or @decorative annotation found. Screen reader users will hear only \"image\". Add a % @alt: annotation before \\includegraphics."
    );
    return { level: "poor", message: "No accessibility metadata", warnings };
  }

  /**
   * Get the effective alt text for an image, applying the priority rules:
   * 1. @decorative → alt=""
   * 2. @alt → use as alt
   * 3. caption (when no @alt) → use as fallback alt
   * 4. nothing → "image"
   *
   * @param {Object} ref - Image reference from detectImageReferences()
   * @returns {string} The alt text to use
   */
  function getEffectiveAltText(ref) {
    if (ref.isDecorative) {
      return "";
    }
    if (ref.altText) {
      return ref.altText;
    }
    if (ref.captionText) {
      return ref.captionText;
    }
    return "image";
  }

  /**
   * Get list of image filenames that are referenced but not yet uploaded
   * @param {string} latex - LaTeX source content
   * @returns {Array<Object>} Array of missing image references
   */
  function getMissingImages(latex) {
    const references = detectImageReferences(latex);
    return references.filter((ref) => !imageRegistry.has(ref.filename));
  }

  /**
   * Check whether all referenced images have been uploaded
   * @param {string} latex - LaTeX source content
   * @returns {boolean} True if all images are available
   */
  function allImagesAvailable(latex) {
    return getMissingImages(latex).length === 0;
  }

  /**
   * Get accessibility warnings for all images in the document
   * @param {string} latex - LaTeX source content
   * @returns {Array<Object>} Array of { filename, level, message, warnings }
   */
  function getAccessibilityReport(latex) {
    const references = detectImageReferences(latex);
    return references.map((ref) => ({
      filename: ref.filename,
      level: ref.accessibilityStatus.level,
      message: ref.accessibilityStatus.message,
      warnings: ref.accessibilityStatus.warnings,
    }));
  }

  // ===========================================================================================
  // IMAGE UPLOAD AND CONVERSION
  // ===========================================================================================

  /**
   * Register an uploaded image file against a LaTeX filename
   * Converts to the smallest format (WebP vs PNG) for export efficiency
   * @param {string} filename - The filename as referenced in LaTeX
   * @param {File} file - The uploaded File object
   * @returns {Promise<Object>} Registration result with objectUrl and metadata
   */
  async function registerImage(filename, file) {
    logInfo(`Registering image: "${filename}" (${file.size} bytes, ${file.type})`);

    try {
      // Create Object URL for immediate preview use
      const objectUrl = URL.createObjectURL(file);

      // Load image to get dimensions and convert to optimal format
      const img = await loadImageFromUrl(objectUrl);

      logDebug(`Image loaded: ${img.width}x${img.height}`);

      // Convert to optimal base64 format (smallest of WebP vs PNG)
      const conversionResult = await convertToOptimalBase64(img);

      // Parse annotations from current LaTeX input
      let annotations = { altText: null, isDecorative: false, longDescription: null };
      let captionText = null;

      const contentEditableEl = document.getElementById("input-contenteditable");
      const inputEl = document.getElementById("input");
      const latex = contentEditableEl?.textContent || inputEl?.value || "";

      if (latex) {
        // Find the includegraphics for this filename and parse its annotations
        const refs = detectImageReferences(latex);
        const matchedRef = refs.find((r) => r.filename === filename);
        if (matchedRef) {
          annotations.altText = matchedRef.altText;
          annotations.isDecorative = matchedRef.isDecorative;
          annotations.longDescription = matchedRef.longDescription;
          captionText = matchedRef.captionText;
        }
      }

      const entry = {
        file,
        objectUrl,
        base64DataUrl: conversionResult.dataUrl,
        mimeType: conversionResult.mimeType,
        format: conversionResult.format,
        width: img.width,
        height: img.height,
        altText: annotations.altText,
        isDecorative: annotations.isDecorative,
        longDescription: annotations.longDescription,
        captionText,
        originalSize: file.size,
        base64Size: conversionResult.dataUrl.length,
        registeredAt: Date.now(),
      };

      // Revoke any previous Object URL for the same filename
      if (imageRegistry.has(filename)) {
        const old = imageRegistry.get(filename);
        if (old.objectUrl) {
          URL.revokeObjectURL(old.objectUrl);
        }
        logInfo(`Replaced existing image: "${filename}"`);
      }

      imageRegistry.set(filename, entry);

      logInfo(
        `✅ Image registered: "${filename}" — ` +
          `${img.width}×${img.height}, ${conversionResult.format}, ` +
          `${(conversionResult.dataUrl.length / 1024).toFixed(1)}KB base64` +
          (annotations.isDecorative ? " [decorative]" : "") +
          (annotations.altText ? ` [alt: "${annotations.altText.substring(0, 40)}..."]` : "") +
          (annotations.longDescription ? " [has longdesc]" : "")
      );

      return entry;
    } catch (error) {
      logError(`Failed to register image "${filename}":`, error);
      throw error;
    }
  }

  /**
   * Load an image from a URL into an Image element
   * @param {string} url - Image source URL (Object URL or data URL)
   * @returns {Promise<HTMLImageElement>} Loaded image element
   */
  function loadImageFromUrl(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () =>
        reject(new Error("Failed to load image from URL"));
      img.src = url;
    });
  }

  /**
   * Convert an image to the smallest base64 format (WebP vs PNG)
   * @param {HTMLImageElement} img - Loaded image element
   * @param {number} quality - WebP quality (0-1), default 0.85
   * @returns {Object} { dataUrl, mimeType, format, base64Length }
   */
  async function convertToOptimalBase64(img, quality = 0.85) {
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    // Generate both formats
    const webpDataUrl = canvas.toDataURL("image/webp", quality);
    const pngDataUrl = canvas.toDataURL("image/png");

    // Check if WebP is actually supported (some browsers return PNG)
    const webpSupported = webpDataUrl.startsWith("data:image/webp");

    let chosen;
    if (webpSupported && webpDataUrl.length < pngDataUrl.length) {
      chosen = {
        dataUrl: webpDataUrl,
        mimeType: "image/webp",
        format: "webp",
      };
    } else {
      chosen = {
        dataUrl: pngDataUrl,
        mimeType: "image/png",
        format: "png",
      };
    }

    chosen.base64Length = chosen.dataUrl.split(",")[1]?.length || 0;

    logDebug(
      `Format comparison — PNG: ${(pngDataUrl.length / 1024).toFixed(1)}KB, ` +
        `WebP: ${webpSupported ? (webpDataUrl.length / 1024).toFixed(1) + "KB" : "unsupported"} ` +
        `→ chose ${chosen.format}`
    );

    return chosen;
  }

  // ===========================================================================================
  // PER-OCCURRENCE ANNOTATION HELPERS
  // ===========================================================================================

  /**
   * Get the current LaTeX source from the editor.
   * @returns {string} LaTeX source or empty string
   */
  function getCurrentLatex() {
    const contentEditableEl = document.getElementById("input-contenteditable");
    const inputEl = document.getElementById("input");
    return contentEditableEl?.textContent || inputEl?.value || "";
  }

  /**
   * Build a per-filename occurrence map from image references.
   * Each filename maps to an ordered array of per-occurrence annotation objects.
   *
   * @param {Array<Object>} refs - Array from detectImageReferences()
   * @returns {Map<string, Array<Object>>} filename → [ref1, ref2, ...]
   */
  function buildOccurrenceMap(refs) {
    const map = new Map();
    for (const ref of refs) {
      if (!map.has(ref.filename)) {
        map.set(ref.filename, []);
      }
      map.get(ref.filename).push(ref);
    }
    return map;
  }

  /**
   * Find the registry filename that matches a given src (exact or basename match).
   * @param {string} src - Image src attribute value
   * @returns {string|null} Matched registry filename or null
   */
  function findRegistryFilename(src) {
    if (imageRegistry.has(src)) return src;

    const basename = src.split("/").pop();
    for (const registeredName of imageRegistry.keys()) {
      if (registeredName.split("/").pop() === basename) {
        return registeredName;
      }
    }
    return null;
  }

  /**
   * Get the next per-occurrence reference for a filename, tracking HTML element order.
   * Increments the counter for that filename so successive calls return successive occurrences.
   *
   * @param {Map<string, Array<Object>>} occurrenceMap - From buildOccurrenceMap()
   * @param {Object} counters - Mutable object tracking current index per filename
   * @param {string} filename - The registry filename
   * @returns {Object|null} The per-occurrence reference, or null if not found
   */
  function getNextOccurrence(occurrenceMap, counters, filename) {
    if (!filename || !occurrenceMap.has(filename)) return null;

    const occurrences = occurrenceMap.get(filename);
    const currentIndex = counters[filename] || 0;

    if (currentIndex >= occurrences.length) {
      // More HTML images than LaTeX occurrences — should not happen, but be safe
      logWarn(
        `More <img> elements than \\includegraphics occurrences for "${filename}"`
      );
      return null;
    }

    counters[filename] = currentIndex + 1;
    return occurrences[currentIndex];
  }

  // ===========================================================================================
  // IMAGE REPLACEMENT IN HTML
  // ===========================================================================================

  /**
   * Generate a unique ID for long description linkage
   * @param {string} filename - Image filename
   * @returns {string} A DOM-safe ID string
   */
  function generateLongDescId(filename) {
    const safe = filename.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-");
    return `longdesc-${safe}`;
  }

/**
   * Replace image src attributes in HTML with Object URLs for preview display.
   * Applies per-occurrence alt text, decorative marking, and long description attributes.
   * Uses DOM-based replacement for reliability.
   * @param {HTMLElement} container - DOM element containing the HTML to process
   * @returns {number} Number of images replaced
   */
  function replaceImagesForPreview(container) {
    if (!container || imageRegistry.size === 0) {
      return 0;
    }

    // Get per-occurrence annotations from the current LaTeX source
    const latex = getCurrentLatex();
    const refs = latex ? detectImageReferences(latex) : [];
    const occurrenceMap = buildOccurrenceMap(refs);
    const htmlOccurrenceCounters = {};

    const imgs = container.querySelectorAll("img");
    let replacedCount = 0;

    imgs.forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;

      // Try exact match first, then basename match
      const entry = findRegistryEntry(src);

      if (entry) {
        img.setAttribute("src", entry.objectUrl);

        // Apply per-occurrence accessibility attributes
        const registryFilename = findRegistryFilename(src);
        const occurrenceRef = getNextOccurrence(occurrenceMap, htmlOccurrenceCounters, registryFilename);
        applyAccessibilityAttributes(img, entry, container, occurrenceRef);

        // Add data attributes to mark as managed
        img.setAttribute("data-image-asset", "true");
        img.setAttribute("data-original-src", src);

        replacedCount++;
        logDebug(`Preview: replaced src for "${src}" (occurrence ${htmlOccurrenceCounters[registryFilename] || 0})`);
      }
    });

    if (replacedCount > 0) {
      logInfo(`✅ Replaced ${replacedCount} image(s) for preview display`);
    }

    return replacedCount;
  }

/**
   * Replace image src attributes in an HTML string with base64 data URLs for export.
   * Applies per-occurrence alt text, decorative attributes, and injects long description elements.
   * Uses position-aware annotation matching so the same filename used multiple times
   * gets the correct annotations for each occurrence.
   * @param {string} html - HTML content string
   * @returns {string} HTML with embedded base64 images and accessibility attributes
   */
  function replaceImagesForExport(html) {
    if (!html || imageRegistry.size === 0) {
      return html;
    }

    // Get per-occurrence annotations from the current LaTeX source
    const latex = getCurrentLatex();
    const refs = latex ? detectImageReferences(latex) : [];
    const occurrenceMap = buildOccurrenceMap(refs);
    const htmlOccurrenceCounters = {};

    // Use DOM parsing for reliable replacement
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    const imgs = tempDiv.querySelectorAll("img");
    let replacedCount = 0;

    imgs.forEach((img) => {
      const src = img.getAttribute("src");
      if (!src) return;

      // Skip already-embedded images (data URLs or blob URLs)
      if (src.startsWith("data:") || src.startsWith("blob:")) {
        // For blob URLs, try matching via data-original-src
        const originalSrc = img.getAttribute("data-original-src");
        if (originalSrc && !src.startsWith("data:")) {
          const entry = findRegistryEntry(originalSrc);
          if (entry) {
            img.setAttribute("src", entry.base64DataUrl);
            const registryFilename = findRegistryFilename(originalSrc);
            const occurrenceRef = getNextOccurrence(occurrenceMap, htmlOccurrenceCounters, registryFilename);
            applyAccessibilityAttributes(img, entry, tempDiv, occurrenceRef);
            cleanPreviewAttributes(img);
            replacedCount++;
          }
        }
        return;
      }

      const entry = findRegistryEntry(src);

      if (entry) {
        img.setAttribute("src", entry.base64DataUrl);
        const registryFilename = findRegistryFilename(src);
        const occurrenceRef = getNextOccurrence(occurrenceMap, htmlOccurrenceCounters, registryFilename);
        applyAccessibilityAttributes(img, entry, tempDiv, occurrenceRef);
        cleanPreviewAttributes(img);
        replacedCount++;
        logDebug(`Export: embedded base64 for "${src}" (occurrence ${htmlOccurrenceCounters[registryFilename] || 0})`);
      }
    });

    if (replacedCount > 0) {
      logInfo(`✅ Embedded ${replacedCount} image(s) as base64 for export`);
    }

    return replacedCount > 0 ? tempDiv.innerHTML : html;
  }

  /**
   * Find a registry entry by src, trying exact match then basename match
   * @param {string} src - Image src attribute value
   * @returns {Object|undefined} Registry entry or undefined
   */
  function findRegistryEntry(src) {
    // Exact match
    let entry = imageRegistry.get(src);
    if (entry) return entry;

    // Basename match (Pandoc may strip or alter directory paths)
    const basename = src.split("/").pop();
    for (const [registeredName, registeredEntry] of imageRegistry) {
      if (registeredName.split("/").pop() === basename) {
        return registeredEntry;
      }
    }

    return undefined;
  }

/**
   * Apply accessibility attributes to an img element.
   * Uses per-occurrence annotation data when available (occurrenceRef),
   * falling back to registry entry metadata.
   *
   * @param {HTMLImageElement} img - The image element to modify
   * @param {Object} entry - Registry entry with image binary data and fallback metadata
   * @param {HTMLElement} container - Parent container (for injecting long description elements)
   * @param {Object|null} occurrenceRef - Per-occurrence reference from detectImageReferences()
   *   If provided, its annotations take priority over registry entry metadata.
   */
  function applyAccessibilityAttributes(img, entry, container, occurrenceRef) {
    // Resolve annotation data: prefer per-occurrence, fall back to registry entry
    const isDecorative = occurrenceRef ? occurrenceRef.isDecorative : entry.isDecorative;
    const altText = occurrenceRef ? occurrenceRef.altText : entry.altText;
    const captionText = occurrenceRef ? occurrenceRef.captionText : entry.captionText;
    const longDescription = occurrenceRef ? occurrenceRef.longDescription : entry.longDescription;
    const filename = occurrenceRef ? occurrenceRef.filename : "unknown";

    // Scenario 2: Decorative image
    if (isDecorative) {
      img.setAttribute("alt", "");
      img.setAttribute("role", "presentation");
      logDebug(`Applied decorative attributes to image`);
      return;
    }

    // Determine effective alt text (priority: @alt > caption > leave existing)
    const currentAlt = img.getAttribute("alt");

    if (altText) {
      // Scenario 1/3/4: Explicit @alt annotation
      img.setAttribute("alt", altText);
    } else if (captionText) {
      // Scenario 5 fallback: use caption if no @alt provided for this occurrence
      if (!currentAlt || currentAlt === "image") {
        img.setAttribute("alt", captionText);
        logWarn(
          `No @alt annotation found for "${filename}" — using caption text as fallback. ` +
            `Consider adding a % @alt: annotation before \\includegraphics.`
        );
      }
    } else if (!currentAlt || currentAlt === "image") {
      // No @alt, no caption — set generic fallback with warning
      img.setAttribute("alt", `Image: ${filename}`);
      logWarn(
        `No @alt annotation or caption found for "${filename}" — using generic fallback. ` +
          `Add a % @alt: annotation before \\includegraphics for accessibility.`
      );
    }
    // If nothing available but currentAlt is set, leave existing alt (Pandoc may have set something)

    // Scenario 4: Long description
    if (longDescription && container) {
      const descId = generateLongDescId(
        img.getAttribute("data-original-src") ||
          img.getAttribute("src") ||
          "unknown"
      );

      img.setAttribute("aria-describedby", descId);

      // Only inject the long description element if it doesn't already exist
      if (!container.querySelector(`#${descId}`)) {
        const descElement = document.createElement("div");
        descElement.id = descId;
        descElement.className = "image-long-description";
        descElement.setAttribute("role", "note");

        // Create a details/summary for progressive disclosure
        const details = document.createElement("details");
        details.className = "long-description-details";

        const summary = document.createElement("summary");
        summary.textContent = "Image description";

        const descText = document.createElement("p");
        descText.textContent = longDescription;

        details.appendChild(summary);
        details.appendChild(descText);
        descElement.appendChild(details);

        // Insert after the figure or img element
        const figure = img.closest("figure");
        const insertAfter = figure || img;

        if (insertAfter.nextSibling) {
          insertAfter.parentNode.insertBefore(
            descElement,
            insertAfter.nextSibling
          );
        } else if (insertAfter.parentNode) {
          insertAfter.parentNode.appendChild(descElement);
        }

        logDebug(`Injected long description element #${descId}`);
      }
    }
  }

  /**
   * Remove preview-only data attributes from an img element (for clean exports)
   * @param {HTMLImageElement} img
   */
  function cleanPreviewAttributes(img) {
    img.removeAttribute("data-image-asset");
    img.removeAttribute("data-original-src");
  }

  // ===========================================================================================
  // UPLOAD UI HELPERS
  // ===========================================================================================

  /**
   * Prompt user to upload missing images via a file input dialog
   * Handles multiple files and matches them to LaTeX references
   * @param {Array<Object>} missingImages - Array from getMissingImages()
   * @returns {Promise<Object>} Result with uploaded and still missing counts
   */
  async function promptForMissingImages(missingImages) {
    if (!missingImages || missingImages.length === 0) {
      logDebug("No missing images to prompt for");
      return { uploaded: 0, stillMissing: 0 };
    }

    logInfo(
      `Prompting user to upload ${missingImages.length} missing image(s): ` +
        missingImages.map((m) => m.filename).join(", ")
    );

    return new Promise((resolve) => {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.multiple = true;
      fileInput.accept = "image/*";
      fileInput.style.display = "none";
      fileInput.setAttribute("aria-hidden", "true");

      fileInput.onchange = async (event) => {
        const files = Array.from(event.target.files);
        let uploadedCount = 0;

        for (const file of files) {
          const matchedRef = findMatchingReference(file.name, missingImages);

          if (matchedRef) {
            try {
              await registerImage(matchedRef.filename, file);
              uploadedCount++;
            } catch (error) {
              logError(`Failed to register "${file.name}":`, error);
            }
          } else {
            logWarn(
              `Uploaded file "${file.name}" doesn't match any missing reference`
            );
          }
        }

        document.body.removeChild(fileInput);

        const stillMissing = missingImages.length - uploadedCount;

        if (uploadedCount > 0 && window.UniversalNotifications) {
          window.UniversalNotifications.success(
            `${uploadedCount} image(s) uploaded successfully` +
              (stillMissing > 0
                ? `. ${stillMissing} still missing.`
                : ".")
          );
        }

        resolve({ uploaded: uploadedCount, stillMissing });
      };

      fileInput.addEventListener("cancel", () => {
        document.body.removeChild(fileInput);
        resolve({ uploaded: 0, stillMissing: missingImages.length });
      });

      document.body.appendChild(fileInput);
      fileInput.click();
    });
  }

  /**
   * Match an uploaded filename to a missing image reference
   * @param {string} uploadedName - Name of the uploaded file
   * @param {Array<Object>} references - Array of missing image references
   * @returns {Object|null} Matched reference or null
   */
  function findMatchingReference(uploadedName, references) {
    const uploadedBasename = uploadedName.split("/").pop().toLowerCase();

    const exact = references.find(
      (ref) => ref.filename.toLowerCase() === uploadedName.toLowerCase()
    );
    if (exact) return exact;

    const basename = references.find(
      (ref) =>
        ref.filename.split("/").pop().toLowerCase() === uploadedBasename
    );
    if (basename) return basename;

    return null;
  }

  // ===========================================================================================
  // REGISTRY MANAGEMENT
  // ===========================================================================================

  /**
   * Get the current image registry as a plain object (for debugging/testing)
   * @returns {Object} Registry contents with accessibility info
   */
  function getRegistryInfo() {
    const info = {};
    imageRegistry.forEach((entry, filename) => {
      info[filename] = {
        format: entry.format,
        dimensions: `${entry.width}×${entry.height}`,
        originalSize: `${(entry.originalSize / 1024).toFixed(1)}KB`,
        base64Size: `${(entry.base64Size / 1024).toFixed(1)}KB`,
        altText: entry.altText,
        isDecorative: entry.isDecorative,
        longDescription: entry.longDescription
          ? entry.longDescription.substring(0, 80) + "..."
          : null,
        captionText: entry.captionText,
        hasObjectUrl: !!entry.objectUrl,
        hasBase64: !!entry.base64DataUrl,
      };
    });
    return info;
  }

  /**
   * Get the number of registered images
   * @returns {number}
   */
  function getImageCount() {
    return imageRegistry.size;
  }

  /**
   * Check if a specific filename is registered
   * @param {string} filename
   * @returns {boolean}
   */
  function hasImage(filename) {
    return imageRegistry.has(filename);
  }

  /**
   * Get a specific registry entry
   * @param {string} filename
   * @returns {Object|undefined}
   */
  function getImage(filename) {
    return imageRegistry.get(filename);
  }

  /**
   * Clear all registered images and revoke Object URLs
   */
  function clearRegistry() {
    imageRegistry.forEach((entry) => {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
    });
    imageRegistry.clear();
    logInfo("Image registry cleared");
  }

  /**
   * Remove a specific image from the registry
   * @param {string} filename
   * @returns {boolean} True if image was removed
   */
  function removeImage(filename) {
    const entry = imageRegistry.get(filename);
    if (entry) {
      if (entry.objectUrl) {
        URL.revokeObjectURL(entry.objectUrl);
      }
      imageRegistry.delete(filename);
      logInfo(`Removed image: "${filename}"`);
      return true;
    }
    return false;
  }

  // ===========================================================================================
  // PUBLIC API
  // ===========================================================================================

  return {
    // Detection and annotations
    detectImageReferences,
    getMissingImages,
    allImagesAvailable,
    extractCaptionForImage,
    parseAnnotations,
    getEffectiveAltText,
    getAccessibilityReport,

    // Upload and registration
    registerImage,
    promptForMissingImages,

    // HTML replacement
    replaceImagesForPreview,
    replaceImagesForExport,

    // Registry management
    getRegistryInfo,
    getImageCount,
    hasImage,
    getImage,
    clearRegistry,
    removeImage,

    // Logging (for testing)
    logError,
    logWarn,
    logInfo,
    logDebug,
  };
})();

// Make globally available
window.ImageAssetManager = ImageAssetManager;
