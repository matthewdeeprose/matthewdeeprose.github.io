/**
 * Image Describer Camera Capture Tests
 * =====================================
 * Comprehensive console-runnable test suite for the camera capture feature.
 * Stage 4 of 4-stage camera implementation.
 *
 * Usage:
 *   await window.testImageDescriberCamera();                     // Run all tests
 *   await window.testImageDescriberCameraComponent("dom");       // Run specific category
 *
 * Categories: dom, state, cache, methods, availability, ui, transforms, canvas, cleanup, a11y
 *
 * @version 1.0.0
 */
(function () {
  "use strict";

  // ==========================================================================
  // LOGGING CONFIGURATION
  // ==========================================================================

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
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[CameraTests] ${message}`, ...args);
  }
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[CameraTests] ${message}`, ...args);
  }
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[CameraTests] ${message}`, ...args);
  }
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[CameraTests] ${message}`, ...args);
  }

  // ==========================================================================
  // TEST RUNNER INFRASTRUCTURE
  // ==========================================================================

  /**
   * Lightweight test runner for console output
   */
  function createRunner(categoryLabel, categoryEmoji) {
    const results = { passed: 0, failed: 0, errors: [] };

    function pass(label) {
      results.passed++;
      console.log(`  ✅ ${label}`);
    }

    function fail(label, detail) {
      results.failed++;
      const msg = detail ? `${label}: ${detail}` : label;
      results.errors.push(msg);
      console.log(`  ❌ ${msg}`);
    }

    function check(label, condition, detail) {
      if (condition) {
        pass(label);
      } else {
        fail(label, detail || "FAILED");
      }
    }

    function header() {
      console.log(`\n${categoryEmoji} Camera Tests: ${categoryLabel}`);
      console.log("─".repeat(45));
    }

    function summary() {
      const total = results.passed + results.failed;
      console.log("─".repeat(45));
      if (results.failed === 0) {
        console.log(`${total}/${total} passed ✅`);
      } else {
        console.log(
          `${results.passed}/${total} passed — ${results.failed} FAILED`
        );
      }
      return { passed: results.passed, failed: results.failed, total };
    }

    return { pass, fail, check, header, summary };
  }

  // ==========================================================================
  // STATE SAVE / RESTORE
  // ==========================================================================

  function saveState() {
    const ctrl = window.ImageDescriberController;
    if (!ctrl) return null;
    const el = ctrl.elements || {};
    return {
      // Controller state
      cameraInstance: ctrl.cameraInstance,
      cameraInitialised: ctrl.cameraInitialised,
      capturedPhotoFile: ctrl.capturedPhotoFile,
      capturedPhotoUrl: ctrl.capturedPhotoUrl,
      postCaptureRotation: ctrl.postCaptureRotation,
      postCaptureFlipped: ctrl.postCaptureFlipped,
      // DOM state
      videoHidden: el.cameraVideo ? el.cameraVideo.hidden : undefined,
      videoTabIndex: el.cameraVideo ? el.cameraVideo.tabIndex : undefined,
      capturedHidden: el.cameraCaptured ? el.cameraCaptured.hidden : undefined,
      capturedSrc: el.cameraCaptured ? el.cameraCaptured.src : undefined,
      capturedTransform: el.cameraCaptured
        ? el.cameraCaptured.style.transform
        : undefined,
      controlsHidden: el.cameraControls
        ? el.cameraControls.hidden
        : undefined,
      adjustHidden: el.cameraAdjust ? el.cameraAdjust.hidden : undefined,
      unavailableHidden: el.cameraUnavailable
        ? el.cameraUnavailable.hidden
        : undefined,
      infoHidden: el.cameraInfo ? el.cameraInfo.hidden : undefined,
      statusText: el.cameraStatusText
        ? el.cameraStatusText.textContent
        : undefined,
    };
  }

  function restoreState(saved) {
    if (!saved) return;
    const ctrl = window.ImageDescriberController;
    if (!ctrl) return;
    const el = ctrl.elements || {};

    // Restore controller state
    ctrl.cameraInstance = saved.cameraInstance;
    ctrl.cameraInitialised = saved.cameraInitialised;
    ctrl.capturedPhotoFile = saved.capturedPhotoFile;
    ctrl.capturedPhotoUrl = saved.capturedPhotoUrl;
    ctrl.postCaptureRotation = saved.postCaptureRotation;
    ctrl.postCaptureFlipped = saved.postCaptureFlipped;

    // Restore DOM state
    if (el.cameraVideo && saved.videoHidden !== undefined) {
      el.cameraVideo.hidden = saved.videoHidden;
      el.cameraVideo.tabIndex = saved.videoTabIndex;
    }
    if (el.cameraCaptured && saved.capturedHidden !== undefined) {
      el.cameraCaptured.hidden = saved.capturedHidden;
      el.cameraCaptured.src = saved.capturedSrc;
      el.cameraCaptured.style.transform = saved.capturedTransform;
    }
    if (el.cameraControls && saved.controlsHidden !== undefined) {
      el.cameraControls.hidden = saved.controlsHidden;
    }
    if (el.cameraAdjust && saved.adjustHidden !== undefined) {
      el.cameraAdjust.hidden = saved.adjustHidden;
    }
    if (el.cameraUnavailable && saved.unavailableHidden !== undefined) {
      el.cameraUnavailable.hidden = saved.unavailableHidden;
    }
    if (el.cameraInfo && saved.infoHidden !== undefined) {
      el.cameraInfo.hidden = saved.infoHidden;
    }
    if (el.cameraStatusText && saved.statusText !== undefined) {
      el.cameraStatusText.textContent = saved.statusText;
    }
  }

  // ==========================================================================
  // TEST HELPERS
  // ==========================================================================

  /**
   * Create a small test image File with known dimensions
   * @param {number} width
   * @param {number} height
   * @returns {Promise<File>}
   */
  function createTestImageFile(width, height) {
    return new Promise((resolve) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // Paint a simple pattern so it's not blank
      ctx.fillStyle = "#ff0000";
      ctx.fillRect(0, 0, width, height);
      // Top-left pixel blue for orientation verification
      ctx.fillStyle = "#0000ff";
      ctx.fillRect(0, 0, 1, 1);
      canvas.toBlob(
        (blob) => {
          const file = new File([blob], "test-image.jpg", {
            type: "image/jpeg",
          });
          resolve(file);
        },
        "image/jpeg",
        0.92
      );
    });
  }

  /**
   * Get dimensions of an image File
   * @param {File} file
   * @returns {Promise<{width: number, height: number}>}
   */
  function getImageDimensions(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error("Failed to load image for dimension check"));
      };
      img.src = url;
    });
  }

  // ==========================================================================
  // PRE-TEST GUARD
  // ==========================================================================

  function guardCheck() {
    const ctrl = window.ImageDescriberController;
    if (!ctrl) {
      console.error(
        "❌ Cannot run camera tests: ImageDescriberController not found."
      );
      console.error(
        "   Ensure the Image Describer tool is active before running tests."
      );
      return false;
    }
    if (!ctrl._initialized) {
      console.error(
        "❌ Cannot run camera tests: ImageDescriberController not initialised."
      );
      console.error(
        "   Ensure the Image Describer tool is active before running tests."
      );
      return false;
    }
    if (!ctrl.elements || Object.keys(ctrl.elements).length === 0) {
      console.error(
        "❌ Cannot run camera tests: controller.elements is empty."
      );
      console.error("   Ensure the tool DOM has been rendered.");
      return false;
    }
    return true;
  }

  // ==========================================================================
  // CATEGORY 1: DOM VERIFICATION
  // ==========================================================================

  function testDom() {
    const r = createRunner("DOM Verification", "📷");
    r.header();

    try {
      const details = document.getElementById("imgdesc-camera-section");
      r.check("1.1 Details element exists", !!details, "NOT FOUND");

      r.check(
        "1.2 Details has camera-section class",
        details && details.classList.contains("imgdesc-camera-section"),
        "Missing class"
      );

      const summary = details ? details.querySelector("summary") : null;
      r.check("1.3 Summary exists inside details", !!summary, "NOT FOUND");

      r.check(
        "1.4 Summary has camera icon (data-icon=\"camera\")",
        summary && !!summary.querySelector('[data-icon="camera"]'),
        "Missing icon"
      );

      const instructSpan = document.getElementById(
        "image-camera-summary-instruct"
      );
      r.check(
        "1.5 Summary has instruction text",
        instructSpan && instructSpan.textContent.trim().length > 0,
        "Empty or missing"
      );

      const video = document.getElementById("imgdesc-camera-video");
      r.check("1.6 Video element exists", !!video, "NOT FOUND");

      r.check(
        "1.7 Video has autoplay and playsinline",
        video &&
          video.hasAttribute("autoplay") &&
          video.hasAttribute("playsinline"),
        "Missing attributes"
      );

      r.check(
        "1.8 Video has tabindex=\"-1\" initially",
        video && video.tabIndex === -1,
        `tabIndex is ${video ? video.tabIndex : "N/A"}`
      );

      r.check(
        "1.9 Video has aria-label",
        video &&
          video.getAttribute("aria-label") &&
          video.getAttribute("aria-label").length > 0,
        "Missing aria-label"
      );

      const captured = document.getElementById("imgdesc-camera-captured");
      r.check(
        "1.10 Captured image exists and is hidden",
        captured && captured.hidden === true,
        captured ? `hidden=${captured.hidden}` : "NOT FOUND"
      );

      r.check(
        "1.11 Captured image has alt attribute",
        captured &&
          captured.getAttribute("alt") &&
          captured.getAttribute("alt").length > 0,
        "Missing alt"
      );

      const status = document.getElementById("imgdesc-camera-status");
      r.check(
        "1.12 Status region has aria-live=\"polite\"",
        status && status.getAttribute("aria-live") === "polite",
        "Missing or wrong value"
      );

      r.check(
        "1.13 Status region has aria-atomic=\"true\"",
        status && status.getAttribute("aria-atomic") === "true",
        "Missing or wrong value"
      );

      r.check(
        "1.14 Status text element exists",
        !!document.getElementById("imgdesc-camera-status-text"),
        "NOT FOUND"
      );

      r.check(
        "1.15 Camera controls container exists",
        !!document.getElementById("imgdesc-camera-controls"),
        "NOT FOUND"
      );

      // Check all 4 camera control buttons
      const startBtn = document.getElementById("imgdesc-camera-start");
      const captureBtn = document.getElementById("imgdesc-camera-capture");
      const mirrorBtn = document.getElementById("imgdesc-camera-mirror");
      const switchBtn = document.getElementById("imgdesc-camera-switch");
      r.check(
        "1.16 All 4 camera control buttons exist",
        !!startBtn && !!captureBtn && !!mirrorBtn && !!switchBtn,
        `start=${!!startBtn} capture=${!!captureBtn} mirror=${!!mirrorBtn} switch=${!!switchBtn}`
      );

      r.check(
        "1.17 Capture, mirror, switch buttons start disabled",
        captureBtn &&
          captureBtn.disabled === true &&
          mirrorBtn &&
          mirrorBtn.disabled === true &&
          switchBtn &&
          switchBtn.disabled === true,
        "Not all disabled"
      );

      r.check(
        "1.18 Start button is NOT disabled initially",
        startBtn && startBtn.disabled === false,
        `disabled=${startBtn ? startBtn.disabled : "N/A"}`
      );

      const adjust = document.getElementById("imgdesc-camera-adjust");
      r.check(
        "1.19 Adjust container exists and is hidden",
        adjust && adjust.hidden === true,
        adjust ? `hidden=${adjust.hidden}` : "NOT FOUND"
      );

      // Check all 4 adjust buttons
      const rotateBtn = document.getElementById("imgdesc-camera-rotate");
      const flipBtn = document.getElementById("imgdesc-camera-flip");
      const confirmBtn = document.getElementById("imgdesc-camera-confirm");
      const retakeBtn = document.getElementById("imgdesc-camera-retake");
      r.check(
        "1.20 All 4 adjust buttons exist",
        !!rotateBtn && !!flipBtn && !!confirmBtn && !!retakeBtn,
        `rotate=${!!rotateBtn} flip=${!!flipBtn} confirm=${!!confirmBtn} retake=${!!retakeBtn}`
      );

      const unavailable = document.getElementById(
        "imgdesc-camera-unavailable"
      );
      r.check(
        "1.21 Unavailable message exists and is hidden",
        unavailable && unavailable.hidden === true,
        unavailable ? `hidden=${unavailable.hidden}` : "NOT FOUND"
      );

      r.check(
        "1.22 Info paragraph exists",
        !!document.getElementById("imgdesc-camera-info"),
        "NOT FOUND"
      );

      r.check(
        "1.23 Confirm button has primary-button class",
        confirmBtn && confirmBtn.classList.contains("primary-button"),
        "Missing class"
      );

      // Check all camera buttons have type="button"
      const section = document.getElementById("imgdesc-camera-section");
      const allButtons = section
        ? Array.from(section.querySelectorAll("button"))
        : [];
      const allHaveType = allButtons.every(
        (btn) => btn.getAttribute("type") === "button"
      );
      r.check(
        "1.24 All camera buttons have type=\"button\"",
        allButtons.length > 0 && allHaveType,
        `${allButtons.filter((b) => b.getAttribute("type") !== "button").length} missing type`
      );
    } catch (err) {
      r.fail("DOM tests threw an error", err.message);
      logError("DOM test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 2: CONTROLLER STATE
  // ==========================================================================

  function testState() {
    const r = createRunner("Controller State", "📦");
    r.header();

    try {
      const ctrl = window.ImageDescriberController;

      r.check(
        "2.1 cameraInstance exists and is null",
        "cameraInstance" in ctrl && ctrl.cameraInstance === null,
        `value=${ctrl.cameraInstance}`
      );

      r.check(
        "2.2 cameraInitialised exists and is false",
        "cameraInitialised" in ctrl && ctrl.cameraInitialised === false,
        `value=${ctrl.cameraInitialised}`
      );

      r.check(
        "2.3 capturedPhotoFile exists and is null",
        "capturedPhotoFile" in ctrl && ctrl.capturedPhotoFile === null,
        `value=${ctrl.capturedPhotoFile}`
      );

      r.check(
        "2.4 capturedPhotoUrl exists and is null",
        "capturedPhotoUrl" in ctrl && ctrl.capturedPhotoUrl === null,
        `value=${ctrl.capturedPhotoUrl}`
      );

      r.check(
        "2.5 postCaptureRotation exists and is 0",
        "postCaptureRotation" in ctrl && ctrl.postCaptureRotation === 0,
        `value=${ctrl.postCaptureRotation}`
      );

      r.check(
        "2.6 postCaptureFlipped exists and is false",
        "postCaptureFlipped" in ctrl && ctrl.postCaptureFlipped === false,
        `value=${ctrl.postCaptureFlipped}`
      );
    } catch (err) {
      r.fail("State tests threw an error", err.message);
      logError("State test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 3: ELEMENT CACHE
  // ==========================================================================

  function testCache() {
    const r = createRunner("Element Cache", "🗃️");
    r.header();

    try {
      const el = window.ImageDescriberController.elements;

      const cacheKeys = [
        ["cameraSection", "3.1", "<details> element"],
        ["cameraVideo", "3.2", "<video> element"],
        ["cameraCaptured", "3.3", "<img> element"],
        ["cameraStatus", "3.4", "status container"],
        ["cameraStatusText", "3.5", "status text span"],
        ["cameraControls", "3.6", "controls container"],
        ["cameraStartBtn", "3.7", "start button"],
        ["cameraStartText", "3.8", "start button text"],
        ["cameraCaptureBtn", "3.9", "capture button"],
        ["cameraMirrorBtn", "3.10", "mirror button"],
        ["cameraSwitchBtn", "3.11", "switch button"],
        ["cameraAdjust", "3.12", "adjust container"],
        ["cameraRotateBtn", "3.13", "rotate button"],
        ["cameraFlipBtn", "3.14", "flip button"],
        ["cameraConfirmBtn", "3.15", "confirm button"],
        ["cameraRetakeBtn", "3.16", "retake button"],
        ["cameraUnavailable", "3.17", "unavailable message"],
        ["cameraInfo", "3.18", "info paragraph"],
      ];

      for (const [key, num, desc] of cacheKeys) {
        r.check(
          `${num} elements.${key} is the ${desc}`,
          el[key] != null,
          `elements.${key} is ${el[key]}`
        );
      }

      // Aggregate check
      const allPresent = cacheKeys.every(([key]) => el[key] != null);
      r.check(
        "3.19 All 18 elements are non-null",
        allPresent,
        `${cacheKeys.filter(([k]) => el[k] == null).map(([k]) => k).join(", ")} missing`
      );
    } catch (err) {
      r.fail("Cache tests threw an error", err.message);
      logError("Cache test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 4: METHODS EXIST
  // ==========================================================================

  function testMethods() {
    const r = createRunner("Methods Exist", "🔧");
    r.header();

    try {
      const ctrl = window.ImageDescriberController;

      const methods = [
        ["initCamera", "4.1"],
        ["showCameraUnavailable", "4.2"],
        ["toggleCamera", "4.3"],
        ["capturePhoto", "4.4"],
        ["toggleCameraMirror", "4.5"],
        ["switchCamera", "4.6"],
        ["showCapturedPreview", "4.7"],
        ["rotateCapturedPhoto", "4.8"],
        ["flipCapturedPhoto", "4.9"],
        ["applyCapturedPreviewTransform", "4.10"],
        ["confirmCapturedPhoto", "4.11"],
        ["retakePhoto", "4.12"],
        ["discardCapturedPhoto", "4.13"],
        ["resetCameraUIToLiveMode", "4.14"],
        ["announceCameraStatus", "4.15"],
        ["applyTransformsToFile", "4.16"],
        ["cleanupCamera", "4.17"],
      ];

      for (const [method, num] of methods) {
        r.check(
          `${num} ${method}() exists`,
          typeof ctrl[method] === "function",
          `typeof=${typeof ctrl[method]}`
        );
      }
    } catch (err) {
      r.fail("Methods tests threw an error", err.message);
      logError("Methods test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 5: CAMERA AVAILABILITY
  // ==========================================================================

  function testAvailability() {
    const r = createRunner("Camera Availability", "🎥");
    r.header();

    try {
      r.check(
        "5.1 UniversalCameraCapture class exists",
        !!window.UniversalCameraCapture,
        "NOT FOUND"
      );

      r.check(
        "5.2 UniversalCameraCapture is a constructor",
        typeof window.UniversalCameraCapture === "function",
        `typeof=${typeof window.UniversalCameraCapture}`
      );

      r.check(
        "5.3 navigator.mediaDevices exists",
        !!navigator.mediaDevices,
        "Not available in this browser"
      );

      r.check(
        "5.4 navigator.mediaDevices.getUserMedia exists",
        !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        "Not available in this browser"
      );
    } catch (err) {
      r.fail("Availability tests threw an error", err.message);
      logError("Availability test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 6: UI STATE TRANSITIONS
  // ==========================================================================

  function testUI() {
    const r = createRunner("UI State Transitions", "🖥️");
    r.header();

    const saved = saveState();

    try {
      const ctrl = window.ImageDescriberController;
      const el = ctrl.elements;

      // --- showCameraUnavailable() tests ---
      ctrl.showCameraUnavailable();

      r.check(
        "6.1 showCameraUnavailable() hides controls",
        el.cameraControls && el.cameraControls.hidden === true,
        `hidden=${el.cameraControls ? el.cameraControls.hidden : "N/A"}`
      );

      r.check(
        "6.2 showCameraUnavailable() hides info",
        el.cameraInfo && el.cameraInfo.hidden === true,
        `hidden=${el.cameraInfo ? el.cameraInfo.hidden : "N/A"}`
      );

      r.check(
        "6.3 showCameraUnavailable() shows unavailable message",
        el.cameraUnavailable && el.cameraUnavailable.hidden === false,
        `hidden=${el.cameraUnavailable ? el.cameraUnavailable.hidden : "N/A"}`
      );

      r.check(
        "6.4 showCameraUnavailable() hides video",
        el.cameraVideo && el.cameraVideo.hidden === true,
        `hidden=${el.cameraVideo ? el.cameraVideo.hidden : "N/A"}`
      );

      // Restore before next batch
      restoreState(saved);

      // --- resetCameraUIToLiveMode() tests ---
      // First set some non-default state to test the reset
      if (el.cameraVideo) el.cameraVideo.hidden = true;
      if (el.cameraCaptured) el.cameraCaptured.hidden = false;
      if (el.cameraControls) el.cameraControls.hidden = true;
      if (el.cameraAdjust) el.cameraAdjust.hidden = false;

      ctrl.resetCameraUIToLiveMode();

      r.check(
        "6.5 resetCameraUIToLiveMode() shows video",
        el.cameraVideo && el.cameraVideo.hidden === false,
        `hidden=${el.cameraVideo ? el.cameraVideo.hidden : "N/A"}`
      );

      r.check(
        "6.6 resetCameraUIToLiveMode() hides captured image",
        el.cameraCaptured && el.cameraCaptured.hidden === true,
        `hidden=${el.cameraCaptured ? el.cameraCaptured.hidden : "N/A"}`
      );

      r.check(
        "6.7 resetCameraUIToLiveMode() shows camera controls",
        el.cameraControls && el.cameraControls.hidden === false,
        `hidden=${el.cameraControls ? el.cameraControls.hidden : "N/A"}`
      );

      r.check(
        "6.8 resetCameraUIToLiveMode() hides adjust controls",
        el.cameraAdjust && el.cameraAdjust.hidden === true,
        `hidden=${el.cameraAdjust ? el.cameraAdjust.hidden : "N/A"}`
      );

      // Restore before next batch
      restoreState(saved);

      // --- announceCameraStatus() tests ---
      ctrl.announceCameraStatus("Test message");
      r.check(
        "6.9 announceCameraStatus(\"Test message\") updates status text",
        el.cameraStatusText &&
          el.cameraStatusText.textContent === "Test message",
        `text="${el.cameraStatusText ? el.cameraStatusText.textContent : "N/A"}"`
      );

      ctrl.announceCameraStatus("");
      r.check(
        "6.10 announceCameraStatus(\"\") clears status text",
        el.cameraStatusText && el.cameraStatusText.textContent === "",
        `text="${el.cameraStatusText ? el.cameraStatusText.textContent : "N/A"}"`
      );
    } catch (err) {
      r.fail("UI tests threw an error", err.message);
      logError("UI test error:", err);
    }

    // Always restore
    restoreState(saved);

    // Verify restoration
    const el = window.ImageDescriberController.elements;
    const r2 = r; // Reuse runner for final check
    r2.check(
      "6.11 Status text restored after tests",
      el.cameraStatusText &&
        el.cameraStatusText.textContent === saved.statusText,
      `expected="${saved.statusText}" got="${el.cameraStatusText ? el.cameraStatusText.textContent : "N/A"}"`
    );

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 7: CSS TRANSFORMS
  // ==========================================================================

  function testTransforms() {
    const r = createRunner("CSS Transforms", "🔄");
    r.header();

    const saved = saveState();

    try {
      const ctrl = window.ImageDescriberController;
      const el = ctrl.elements;
      const capturedEl = el.cameraCaptured;

      // Ensure we have a clean slate
      ctrl.postCaptureRotation = 0;
      ctrl.postCaptureFlipped = false;

      // --- Direct transform tests ---
      ctrl.applyCapturedPreviewTransform();
      const t1 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.1 No rotation, no flip → empty transform",
        t1 === "" || t1 === "none",
        `transform="${t1}"`
      );

      ctrl.postCaptureRotation = 90;
      ctrl.postCaptureFlipped = false;
      ctrl.applyCapturedPreviewTransform();
      const t2 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.2 90° rotation → rotate(90deg)",
        t2.includes("rotate(90deg)") && !t2.includes("scaleX"),
        `transform="${t2}"`
      );

      ctrl.postCaptureRotation = 180;
      ctrl.applyCapturedPreviewTransform();
      const t3 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.3 180° rotation → rotate(180deg)",
        t3.includes("rotate(180deg)"),
        `transform="${t3}"`
      );

      ctrl.postCaptureRotation = 270;
      ctrl.applyCapturedPreviewTransform();
      const t4 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.4 270° rotation → rotate(270deg)",
        t4.includes("rotate(270deg)"),
        `transform="${t4}"`
      );

      ctrl.postCaptureRotation = 0;
      ctrl.postCaptureFlipped = true;
      ctrl.applyCapturedPreviewTransform();
      const t5 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.5 Flip only → scaleX(-1)",
        t5.includes("scaleX(-1)") && !t5.includes("rotate"),
        `transform="${t5}"`
      );

      ctrl.postCaptureRotation = 90;
      ctrl.postCaptureFlipped = true;
      ctrl.applyCapturedPreviewTransform();
      const t6 = capturedEl ? capturedEl.style.transform : "";
      r.check(
        "7.6 90° + flip → rotate(90deg) scaleX(-1)",
        t6.includes("rotate(90deg)") && t6.includes("scaleX(-1)"),
        `transform="${t6}"`
      );

      // --- rotateCapturedPhoto() behaviour ---
      ctrl.postCaptureRotation = 0;
      ctrl.postCaptureFlipped = false;
      ctrl.rotateCapturedPhoto();
      r.check(
        "7.7 rotateCapturedPhoto() increments by 90°",
        ctrl.postCaptureRotation === 90,
        `rotation=${ctrl.postCaptureRotation}`
      );

      // 4 rotations should wrap to 0
      ctrl.postCaptureRotation = 0;
      ctrl.rotateCapturedPhoto(); // 90
      ctrl.rotateCapturedPhoto(); // 180
      ctrl.rotateCapturedPhoto(); // 270
      ctrl.rotateCapturedPhoto(); // 0
      r.check(
        "7.8 4 rotations returns to 0°",
        ctrl.postCaptureRotation === 0,
        `rotation=${ctrl.postCaptureRotation}`
      );

      // --- flipCapturedPhoto() behaviour ---
      ctrl.postCaptureFlipped = false;
      ctrl.flipCapturedPhoto();
      r.check(
        "7.9 flipCapturedPhoto() toggles flip state",
        ctrl.postCaptureFlipped === true,
        `flipped=${ctrl.postCaptureFlipped}`
      );

      ctrl.flipCapturedPhoto();
      r.check(
        "7.10 Double flip returns to false",
        ctrl.postCaptureFlipped === false,
        `flipped=${ctrl.postCaptureFlipped}`
      );

      // --- Announcement tests ---
      ctrl.postCaptureRotation = 0;
      ctrl.postCaptureFlipped = false;
      ctrl.rotateCapturedPhoto(); // sets to 90
      const statusAfterRotate = el.cameraStatusText
        ? el.cameraStatusText.textContent
        : "";
      r.check(
        "7.11 rotateCapturedPhoto() announces state with \"rotated\"",
        statusAfterRotate.toLowerCase().includes("rotated") ||
          statusAfterRotate.toLowerCase().includes("90"),
        `text="${statusAfterRotate}"`
      );

      ctrl.postCaptureRotation = 0;
      ctrl.postCaptureFlipped = false;
      ctrl.flipCapturedPhoto(); // sets to true
      const statusAfterFlip = el.cameraStatusText
        ? el.cameraStatusText.textContent
        : "";
      r.check(
        "7.12 flipCapturedPhoto() announces state with \"flipped\"",
        statusAfterFlip.toLowerCase().includes("flip"),
        `text="${statusAfterFlip}"`
      );
    } catch (err) {
      r.fail("Transform tests threw an error", err.message);
      logError("Transform test error:", err);
    }

    // Always restore
    restoreState(saved);

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 8: CANVAS TRANSFORM
  // ==========================================================================

  async function testCanvas() {
    const r = createRunner("Canvas Transform", "🎨");
    r.header();

    try {
      const ctrl = window.ImageDescriberController;

      // Create a 2×3 test image
      const testFile = await createTestImageFile(2, 3);
      const origDims = await getImageDimensions(testFile);
      logDebug("Test image dimensions:", origDims);

      // 8.1 No transform returns same file reference
      const result1 = await ctrl.applyTransformsToFile(testFile, 0, false);
      r.check(
        "8.1 No transform returns same file reference",
        result1 === testFile,
        "Returned a different file"
      );

      // 8.2 90° rotation swaps dimensions (2×3 → 3×2)
      const result2 = await ctrl.applyTransformsToFile(testFile, 90, false);
      const dims2 = await getImageDimensions(result2);
      r.check(
        "8.2 90° rotation swaps dimensions (2×3 → 3×2)",
        dims2.width === 3 && dims2.height === 2,
        `got ${dims2.width}×${dims2.height}`
      );

      // 8.3 180° rotation preserves dimensions (2×3 → 2×3)
      const result3 = await ctrl.applyTransformsToFile(testFile, 180, false);
      const dims3 = await getImageDimensions(result3);
      r.check(
        "8.3 180° rotation preserves dimensions (2×3 → 2×3)",
        dims3.width === 2 && dims3.height === 3,
        `got ${dims3.width}×${dims3.height}`
      );

      // 8.4 270° rotation swaps dimensions (2×3 → 3×2)
      const result4 = await ctrl.applyTransformsToFile(testFile, 270, false);
      const dims4 = await getImageDimensions(result4);
      r.check(
        "8.4 270° rotation swaps dimensions (2×3 → 3×2)",
        dims4.width === 3 && dims4.height === 2,
        `got ${dims4.width}×${dims4.height}`
      );

      // 8.5 Flip only preserves dimensions (2×3 → 2×3)
      const result5 = await ctrl.applyTransformsToFile(testFile, 0, true);
      const dims5 = await getImageDimensions(result5);
      r.check(
        "8.5 Flip only preserves dimensions (2×3 → 2×3)",
        dims5.width === 2 && dims5.height === 3,
        `got ${dims5.width}×${dims5.height}`
      );

      // 8.6 Output is a valid File object (use result2, which was transformed)
      r.check(
        "8.6 Output is a valid File object",
        result2 instanceof File,
        `type=${typeof result2}`
      );

      // 8.7 Output has correct MIME type
      r.check(
        "8.7 Output has correct MIME type",
        result2.type === "image/jpeg",
        `type="${result2.type}"`
      );

      // 8.8 Output preserves filename
      r.check(
        "8.8 Output preserves filename",
        result2.name === testFile.name,
        `name="${result2.name}" expected="${testFile.name}"`
      );

      // 8.9 Metadata preserved and extended
      const metaFile = await createTestImageFile(2, 3);
      metaFile.captureMetadata = {
        source: "camera",
        timestamp: Date.now(),
      };
      const metaResult = await ctrl.applyTransformsToFile(metaFile, 90, true);
      const hasMeta =
        metaResult.captureMetadata &&
        metaResult.captureMetadata.source === "camera" &&
        metaResult.captureMetadata.postProcessRotation === 90 &&
        metaResult.captureMetadata.postProcessFlipped === true;
      r.check(
        "8.9 Metadata preserved and extended",
        hasMeta,
        metaResult.captureMetadata
          ? JSON.stringify(metaResult.captureMetadata)
          : "No metadata"
      );
    } catch (err) {
      r.fail("Canvas tests threw an error", err.message);
      logError("Canvas test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 9: CLEANUP
  // ==========================================================================

  function testCleanup() {
    const r = createRunner("Cleanup", "🧹");
    r.header();

    const saved = saveState();

    try {
      const ctrl = window.ImageDescriberController;
      const el = ctrl.elements;

      // --- discardCapturedPhoto() tests ---

      // Set dummy state
      ctrl.capturedPhotoFile = { name: "dummy.jpg" };
      ctrl.capturedPhotoUrl = "blob:http://test/dummy";
      ctrl.postCaptureRotation = 90;
      ctrl.postCaptureFlipped = true;
      if (el.cameraCaptured) {
        el.cameraCaptured.hidden = false;
        el.cameraCaptured.src = "blob:http://test/dummy";
        el.cameraCaptured.style.transform = "rotate(90deg)";
      }

      ctrl.discardCapturedPhoto();

      r.check(
        "9.1 discardCapturedPhoto() nulls capturedPhotoFile",
        ctrl.capturedPhotoFile === null,
        `value=${ctrl.capturedPhotoFile}`
      );

      r.check(
        "9.2 discardCapturedPhoto() nulls capturedPhotoUrl",
        ctrl.capturedPhotoUrl === null,
        `value=${ctrl.capturedPhotoUrl}`
      );

      r.check(
        "9.3 discardCapturedPhoto() resets rotation to 0",
        ctrl.postCaptureRotation === 0,
        `value=${ctrl.postCaptureRotation}`
      );

      r.check(
        "9.4 discardCapturedPhoto() resets flip to false",
        ctrl.postCaptureFlipped === false,
        `value=${ctrl.postCaptureFlipped}`
      );

      r.check(
        "9.5 discardCapturedPhoto() hides captured image",
        el.cameraCaptured && el.cameraCaptured.hidden === true,
        `hidden=${el.cameraCaptured ? el.cameraCaptured.hidden : "N/A"}`
      );

      r.check(
        "9.6 discardCapturedPhoto() clears captured image src",
        el.cameraCaptured &&
          (el.cameraCaptured.src === "" ||
            el.cameraCaptured.getAttribute("src") === ""),
        `src="${el.cameraCaptured ? el.cameraCaptured.getAttribute("src") : "N/A"}"`
      );

      r.check(
        "9.7 discardCapturedPhoto() clears CSS transform",
        el.cameraCaptured && el.cameraCaptured.style.transform === "",
        `transform="${el.cameraCaptured ? el.cameraCaptured.style.transform : "N/A"}"`
      );

      // Restore before cleanupCamera tests
      restoreState(saved);

      // --- cleanupCamera() tests ---

      // Set dummy state
      ctrl.capturedPhotoFile = { name: "dummy.jpg" };
      ctrl.capturedPhotoUrl = "blob:http://test/dummy2";
      ctrl.postCaptureRotation = 180;
      ctrl.postCaptureFlipped = true;
      if (el.cameraCaptured) {
        el.cameraCaptured.hidden = false;
        el.cameraCaptured.style.transform = "rotate(180deg)";
      }
      if (el.cameraVideo) {
        el.cameraVideo.tabIndex = 0;
        el.cameraVideo.hidden = true;
      }
      if (el.cameraAdjust) el.cameraAdjust.hidden = false;

      ctrl.cleanupCamera();

      r.check(
        "9.8 cleanupCamera() calls discardCapturedPhoto effects (file null)",
        ctrl.capturedPhotoFile === null &&
          ctrl.postCaptureRotation === 0 &&
          ctrl.postCaptureFlipped === false,
        `file=${ctrl.capturedPhotoFile} rot=${ctrl.postCaptureRotation} flip=${ctrl.postCaptureFlipped}`
      );

      r.check(
        "9.9 cleanupCamera() resets UI to live mode (video visible)",
        el.cameraVideo && el.cameraVideo.hidden === false,
        `videoHidden=${el.cameraVideo ? el.cameraVideo.hidden : "N/A"}`
      );

      r.check(
        "9.10 cleanupCamera() resets video tabindex to -1",
        el.cameraVideo && el.cameraVideo.tabIndex === -1,
        `tabIndex=${el.cameraVideo ? el.cameraVideo.tabIndex : "N/A"}`
      );

      // Restore before next tests
      restoreState(saved);

      // 9.11 cleanupCamera() does not throw when no camera instance
      const prevInstance = ctrl.cameraInstance;
      ctrl.cameraInstance = null;
      let threwError = false;
      try {
        ctrl.cleanupCamera();
      } catch (e) {
        threwError = true;
      }
      r.check(
        "9.11 cleanupCamera() does not throw when no camera instance",
        !threwError,
        "Threw an error"
      );

      // Restore
      restoreState(saved);

      // 9.12 cleanupCamera() does not null cameraInstance
      const dummyInstance = { cleanup: () => {} };
      ctrl.cameraInstance = dummyInstance;
      ctrl.cleanupCamera();
      r.check(
        "9.12 cleanupCamera() does not null cameraInstance",
        ctrl.cameraInstance === dummyInstance,
        `cameraInstance=${ctrl.cameraInstance}`
      );

      // Restore
      restoreState(saved);

      // 9.13 cleanupCamera() does not reset cameraInitialised
      ctrl.cameraInitialised = true;
      ctrl.cameraInstance = { cleanup: () => {} };
      ctrl.cleanupCamera();
      r.check(
        "9.13 cleanupCamera() does not reset cameraInitialised",
        ctrl.cameraInitialised === true,
        `cameraInitialised=${ctrl.cameraInitialised}`
      );
    } catch (err) {
      r.fail("Cleanup tests threw an error", err.message);
      logError("Cleanup test error:", err);
    }

    // Always restore
    restoreState(saved);

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY 10: ACCESSIBILITY
  // ==========================================================================

  function testA11y() {
    const r = createRunner("Accessibility", "♿");
    r.header();

    try {
      const section = document.getElementById("imgdesc-camera-section");

      // 10.1 Status region has aria-live="polite"
      const status = document.getElementById("imgdesc-camera-status");
      r.check(
        "10.1 Status region has aria-live=\"polite\"",
        status && status.getAttribute("aria-live") === "polite",
        `aria-live="${status ? status.getAttribute("aria-live") : "N/A"}"`
      );

      // 10.2 Status region has aria-atomic="true"
      r.check(
        "10.2 Status region has aria-atomic=\"true\"",
        status && status.getAttribute("aria-atomic") === "true",
        `aria-atomic="${status ? status.getAttribute("aria-atomic") : "N/A"}"`
      );

      // 10.3 All camera buttons have accessible names
      const buttons = section
        ? Array.from(section.querySelectorAll("button"))
        : [];
      const allAccessible = buttons.every((btn) => {
        const ariaLabel = btn.getAttribute("aria-label");
        const textContent = btn.textContent.trim();
        return (ariaLabel && ariaLabel.length > 0) || textContent.length > 0;
      });
      r.check(
        "10.3 All camera buttons have accessible names",
        buttons.length > 0 && allAccessible,
        `${buttons.filter((b) => !(b.getAttribute("aria-label") || b.textContent.trim())).length} buttons missing names`
      );

      // 10.4 Video element has aria-label
      const video = document.getElementById("imgdesc-camera-video");
      r.check(
        "10.4 Video element has aria-label",
        video &&
          video.getAttribute("aria-label") &&
          video.getAttribute("aria-label").length > 0,
        `aria-label="${video ? video.getAttribute("aria-label") : "N/A"}"`
      );

      // 10.5 Captured image has alt text
      const captured = document.getElementById("imgdesc-camera-captured");
      r.check(
        "10.5 Captured image has alt text",
        captured &&
          captured.getAttribute("alt") &&
          captured.getAttribute("alt").length > 0,
        `alt="${captured ? captured.getAttribute("alt") : "N/A"}"`
      );

      // 10.6 Decorative icons are hidden from screen readers
      const icons = section
        ? Array.from(section.querySelectorAll("[data-icon]"))
        : [];
      const allHidden = icons.every(
        (icon) => icon.getAttribute("aria-hidden") === "true"
      );
      r.check(
        "10.6 Decorative icons hidden from screen readers",
        icons.length > 0 && allHidden,
        `${icons.filter((i) => i.getAttribute("aria-hidden") !== "true").length}/${icons.length} not hidden`
      );

      // 10.7 All buttons have type="button"
      const allHaveType = buttons.every(
        (btn) => btn.getAttribute("type") === "button"
      );
      r.check(
        "10.7 All buttons have type=\"button\"",
        buttons.length > 0 && allHaveType,
        `${buttons.filter((b) => b.getAttribute("type") !== "button").length} missing type`
      );

      // 10.8 Camera section uses native <details>
      const details = document.getElementById("imgdesc-camera-section");
      r.check(
        "10.8 Camera section uses native <details> element",
        details && details.tagName === "DETAILS",
        `tagName=${details ? details.tagName : "N/A"}`
      );

      // 10.9 <summary> is first child of <details>
      r.check(
        "10.9 <summary> is first child of <details>",
        details &&
          details.firstElementChild &&
          details.firstElementChild.tagName === "SUMMARY",
        `firstChild=${details && details.firstElementChild ? details.firstElementChild.tagName : "N/A"}`
      );

      // 10.10 Confirm button is identifiable as primary action
      const confirmBtn = document.getElementById("imgdesc-camera-confirm");
      r.check(
        "10.10 Confirm button has primary-button class",
        confirmBtn && confirmBtn.classList.contains("primary-button"),
        "Missing primary-button class"
      );

      // 10.11 Video starts with tabindex="-1"
      r.check(
        "10.11 Video has tabindex=\"-1\" (not in tab order when inactive)",
        video && video.tabIndex === -1,
        `tabIndex=${video ? video.tabIndex : "N/A"}`
      );

      // 10.12 Adjust hint text is present
      const hint = section
        ? section.querySelector(".imgdesc-camera-adjust-hint")
        : null;
      r.check(
        "10.12 Adjust hint text is present",
        hint && hint.textContent.trim().length > 0,
        hint ? `text="${hint.textContent.trim()}"` : "NOT FOUND"
      );
    } catch (err) {
      r.fail("Accessibility tests threw an error", err.message);
      logError("Accessibility test error:", err);
    }

    return r.summary();
  }

  // ==========================================================================
  // CATEGORY MAP
  // ==========================================================================

  const categories = {
    dom: { fn: testDom, label: "DOM Verification", emoji: "📷" },
    state: { fn: testState, label: "Controller State", emoji: "📦" },
    cache: { fn: testCache, label: "Element Cache", emoji: "🗃️" },
    methods: { fn: testMethods, label: "Methods Exist", emoji: "🔧" },
    availability: {
      fn: testAvailability,
      label: "Camera Availability",
      emoji: "🎥",
    },
    ui: { fn: testUI, label: "UI State Transitions", emoji: "🖥️" },
    transforms: { fn: testTransforms, label: "CSS Transforms", emoji: "🔄" },
    canvas: { fn: testCanvas, label: "Canvas Transform", emoji: "🎨" },
    cleanup: { fn: testCleanup, label: "Cleanup", emoji: "🧹" },
    a11y: { fn: testA11y, label: "Accessibility", emoji: "♿" },
  };

  // ==========================================================================
  // GLOBAL EXPORTS
  // ==========================================================================

  /**
   * Run all camera capture tests
   * @returns {Promise<{passed: number, failed: number, total: number}>}
   */
  window.testImageDescriberCamera = async function () {
    if (!guardCheck()) {
      return { passed: 0, failed: 0, total: 0 };
    }

    console.log("\n🎮 Image Describer Camera Tests — Starting");
    console.log("═".repeat(50));

    const totals = { passed: 0, failed: 0 };
    const categoryResults = [];

    for (const [key, cat] of Object.entries(categories)) {
      try {
        const result = await cat.fn();
        totals.passed += result.passed;
        totals.failed += result.failed;
        categoryResults.push({
          label: cat.label,
          emoji: cat.emoji,
          ...result,
        });
      } catch (err) {
        logError(`Category "${key}" threw an uncaught error:`, err);
        totals.failed++;
        categoryResults.push({
          label: cat.label,
          emoji: cat.emoji,
          passed: 0,
          failed: 1,
          total: 1,
        });
      }
    }

    // Final summary
    const grandTotal = totals.passed + totals.failed;
    console.log("\n🎮 Image Describer Camera Tests — Complete");
    console.log("═".repeat(50));

    for (const cr of categoryResults) {
      const status = cr.failed === 0 ? "✅" : "❌";
      const padLabel = cr.emoji + " " + cr.label + ":";
      console.log(
        `${padLabel.padEnd(30)} ${cr.passed}/${cr.total}  ${status}`
      );
    }

    console.log("═".repeat(50));
    if (totals.failed === 0) {
      console.log(
        `Total: ${grandTotal}/${grandTotal} passed — All clear! 🎉`
      );
    } else {
      console.log(
        `Total: ${totals.passed}/${grandTotal} passed — ${totals.failed} FAILED`
      );
    }

    return { passed: totals.passed, failed: totals.failed, total: grandTotal };
  };

  /**
   * Run a specific test category
   * @param {string} category - One of: dom, state, cache, methods, availability, ui, transforms, canvas, cleanup, a11y
   * @returns {Promise<{passed: number, failed: number, total: number}>}
   */
  window.testImageDescriberCameraComponent = async function (category) {
    if (!guardCheck()) {
      return { passed: 0, failed: 0, total: 0 };
    }

    const cat = categories[category];
    if (!cat) {
      console.error(
        `❌ Unknown category: "${category}". Available: ${Object.keys(categories).join(", ")}`
      );
      return { passed: 0, failed: 0, total: 0 };
    }

    try {
      return await cat.fn();
    } catch (err) {
      logError(`Category "${category}" threw an uncaught error:`, err);
      return { passed: 0, failed: 1, total: 1 };
    }
  };

  logInfo("Camera test suite loaded. Use: await testImageDescriberCamera()");
})();
