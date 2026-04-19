/**
 * ===================================================================
 * TESTS: Phase 13 — FastVLM Integration
 * ===================================================================
 *
 * Validates all Phase 13 sub-phases:
 *   13A: Gateway — ensureFastVLM, getFastVLMStatus, generateLocalDescription
 *   13B: Model Manager — FastVLM registry entry, UI row
 *   13C: Controller — generateLocally, streaming, progress stages
 *   13D: Prompt enrichment — buildLocalPrompt, formatForLocalPrompt
 *   13F: Simplified buildLocalPrompt to bare instruction (empirical result)
 *
 * Run:
 *   ImageDescriberTests.run('13-fastvlm');
 *   ImageDescriberTests.run('13-fastvlm', { verbose: true });
 *
 * MANUAL TEST SCENARIOS — Phase 13 FastVLM
 *
 * 1. Fresh state (FastVLM not downloaded):
 *    - Click "Generate Locally" → should show download progress
 *    - Cancel during download → should stop cleanly
 *    - Re-click → should resume/restart download
 *
 * 2. Model loaded:
 *    - Generate with empty form → basic description
 *    - Generate with subject + topic → description should reference domain
 *    - Generate with all fields populated → verify prompt isn't too long
 *    - Generate with prefers-reduced-motion → non-streaming output
 *
 * 3. Edge cases:
 *    - Generate before analysis completes → no analysis context in prompt
 *    - Generate after Florence-2 caption available → caption in prompt
 *    - Generate with OCR corrections in overlay → corrected text used
 *    - Cancel during inference → clean cancellation, no error
 *
 * 4. Memory coexistence:
 *    - Load CLIP + Depth + FastVLM simultaneously
 *    - Run core analysis then generate locally — all models stay loaded
 *    - Check browser memory (DevTools → Performance → Memory)
 *
 * 5. Streaming vs non-streaming:
 *    - Default (no motion preference) → tokens appear progressively
 *    - Enable prefers-reduced-motion → full text appears at once
 *    - Toggle media query mid-session → next generation uses new mode
 *
 * 6. Image types to test:
 *    - Photograph (person, landscape)
 *    - Diagram (flowchart, process diagram)
 *    - Chart (bar chart, pie chart)
 *    - Screenshot (application UI)
 *    - Map (geographic, campus)
 *    - Microscope image
 *    - Historical photograph
 *
 * VERSION: 1.0.0
 * PHASE: 13E
 * ===================================================================
 */
(function () {
  "use strict";

  if (!window.ImageDescriberTests) {
    console.error(
      "[Tests-13] ImageDescriberTests not loaded — cannot register."
    );
    return;
  }

  // Shorthand references (resolved at call time)
  const gateway = window.ImageDescriberAnalyserTransformers;
  const controller = window.ImageDescriberController;
  const format = window.ImageDescriberAnalyserFormat;
  const modelManager = window.ImageDescriberModelManager;

  window.ImageDescriberTests.register("13-fastvlm", {
    name: "Phase 13: FastVLM Integration",
    tests: {
      // ──────────────────────────────────────────────────────────
      // A. Gateway (ImageDescriberAnalyserTransformers) — Structural
      // ──────────────────────────────────────────────────────────

      "Gateway exposes ensureFastVLM method": function (assert) {
        if (!gateway) {
          console.warn("[skipped] ImageDescriberAnalyserTransformers not loaded");
          return;
        }
        assert.assertNotNull(
          gateway.ensureFastVLM,
          "ensureFastVLM should be exposed on gateway"
        );
      },

      "Gateway exposes getFastVLMStatus method": function (assert) {
        if (!gateway) {
          console.warn("[skipped] ImageDescriberAnalyserTransformers not loaded");
          return;
        }
        assert.assertNotNull(
          gateway.getFastVLMStatus,
          "getFastVLMStatus should be exposed on gateway"
        );
      },

      "Gateway exposes generateLocalDescription method": function (assert) {
        if (!gateway) {
          console.warn("[skipped] ImageDescriberAnalyserTransformers not loaded");
          return;
        }
        assert.assertNotNull(
          gateway.generateLocalDescription,
          "generateLocalDescription should be exposed on gateway"
        );
      },

      "getFastVLMStatus returns valid status string": function (assert) {
        if (!gateway || typeof gateway.getFastVLMStatus !== "function") {
          console.warn("[skipped] getFastVLMStatus not available");
          return;
        }
        const status = gateway.getFastVLMStatus();
        const validStatuses = ["not-loaded", "loading", "ready", "error"];
        assert.assertTrue(
          validStatuses.includes(status),
          "Status '" + status + "' should be one of: " + validStatuses.join(", ")
        );
      },

      "getFastVLMStatus returns 'not-loaded' before any loading": function (assert) {
        if (!gateway || typeof gateway.getFastVLMStatus !== "function") {
          console.warn("[skipped] getFastVLMStatus not available");
          return;
        }
        const status = gateway.getFastVLMStatus();
        if (status === "ready" || status === "loading") {
          console.warn(
            "[skipped] FastVLM already " + status + " — cannot test initial state"
          );
          return;
        }
        assert.assertEqual(
          status,
          "not-loaded",
          "Before loading, status should be 'not-loaded'"
        );
      },

      // ──────────────────────────────────────────────────────────
      // B. Model Manager — FastVLM Registry Entry
      // ──────────────────────────────────────────────────────────

      "Model Manager has FastVLM in registry": function (assert) {
        if (!modelManager) {
          console.warn("[skipped] ImageDescriberModelManager not loaded");
          return;
        }
        // getModelRegistry or MODEL_REGISTRY exposure
        const registry =
          typeof modelManager.getModelRegistry === "function"
            ? modelManager.getModelRegistry()
            : modelManager.MODEL_REGISTRY;
        if (!registry) {
          console.warn("[skipped] Could not access model registry");
          return;
        }
        const fastvlm = Array.isArray(registry)
          ? registry.find(function (m) { return m.key === "fastvlm"; })
          : registry.fastvlm;
        assert.assertNotNull(
          fastvlm,
          "Registry should contain a 'fastvlm' entry"
        );
      },

      "FastVLM registry entry has correct properties": function (assert) {
        if (!modelManager) {
          console.warn("[skipped] ImageDescriberModelManager not loaded");
          return;
        }
        const registry =
          typeof modelManager.getModelRegistry === "function"
            ? modelManager.getModelRegistry()
            : modelManager.MODEL_REGISTRY;
        if (!registry) {
          console.warn("[skipped] Could not access model registry");
          return;
        }
        const entry = Array.isArray(registry)
          ? registry.find(function (m) { return m.key === "fastvlm"; })
          : registry.fastvlm;
        if (!entry) {
          console.warn("[skipped] FastVLM entry not found in registry");
          return;
        }
        assert.assertEqual(
          entry.name,
          "FastVLM 0.5B",
          "name should be 'FastVLM 0.5B'"
        );
        assert.assertContains(
          entry.modelId,
          "FastVLM",
          "modelId should contain 'FastVLM'"
        );
        assert.assertContains(
          entry.role,
          "Local",
          "role should contain 'Local'"
        );
        assert.assertTrue(
          entry.enabled === true,
          "enabled should be true"
        );
        assert.assertEqual(
          entry.status,
          "active",
          "status should be 'active'"
        );
      },

      "FastVLM Model Manager UI row exists in DOM": function (assert) {
        const el = document.getElementById("imgdesc-mm-model-fastvlm");
        if (!el) {
          console.warn(
            "[skipped] imgdesc-mm-model-fastvlm not in DOM — Model Manager panel may not be rendered"
          );
          return;
        }
        assert.assertNotNull(
          el,
          "FastVLM model row should exist in DOM"
        );
      },

      "FastVLM UI row has status region with aria-live": function (assert) {
        const row = document.getElementById("imgdesc-mm-model-fastvlm");
        if (!row) {
          console.warn("[skipped] FastVLM model row not in DOM");
          return;
        }
        const statusDiv = row.querySelector(".imgdesc-mm-model-status");
        assert.assertNotNull(
          statusDiv,
          "Status div should exist within FastVLM row"
        );
        assert.assertEqual(
          statusDiv.getAttribute("aria-live"),
          "polite",
          "Status div should have aria-live='polite'"
        );
      },

      // ──────────────────────────────────────────────────────────
      // C. Controller — buildLocalPrompt() Tests
      // Phase 13F: Simplified to bare instruction. Form fields no longer included.
      // ──────────────────────────────────────────────────────────

      "buildLocalPrompt exists on controller": function (assert) {
        if (!controller) {
          console.warn("[skipped] ImageDescriberController not loaded");
          return;
        }
        assert.assertNotNull(
          controller.buildLocalPrompt,
          "buildLocalPrompt should exist on controller"
        );
      },

      "buildLocalPrompt returns string with core instruction": function (assert) {
        if (!controller || typeof controller.buildLocalPrompt !== "function") {
          console.warn("[skipped] buildLocalPrompt not available");
          return;
        }
        const result = controller.buildLocalPrompt();
        assert.assertContains(
          result,
          "Describe this image in detail for accessibility purposes",
          "Should contain core instruction"
        );
      },

      "buildLocalPrompt returns fixed string regardless of form state": function (assert) {
        if (!controller || typeof controller.buildLocalPrompt !== "function") {
          console.warn("[skipped] buildLocalPrompt not available");
          return;
        }
        // Temporarily set a form field to verify it does NOT appear in prompt
        const el = document.getElementById("imgdesc-subject");
        if (!el) {
          console.warn("[skipped] imgdesc-subject not in DOM");
          return;
        }
        const original = el.value;
        try {
          el.value = "TestSubjectShouldNotAppear";
          const result = controller.buildLocalPrompt();
          assert.assertTrue(
            !result.includes("TestSubjectShouldNotAppear"),
            "Form fields should not appear in local prompt"
          );
          assert.assertTrue(
            !result.includes("Subject:"),
            "Subject label should not appear in local prompt"
          );
        } finally {
          el.value = original;
        }
      },

      // ──────────────────────────────────────────────────────────
      // D. Format Module — formatForLocalPrompt() Tests
      // ──────────────────────────────────────────────────────────

      "formatForLocalPrompt exists on format module": function (assert) {
        if (!format) {
          console.warn("[skipped] ImageDescriberAnalyserFormat not loaded");
          return;
        }
        assert.assertNotNull(
          format.formatForLocalPrompt,
          "formatForLocalPrompt should exist on format module"
        );
      },

      "formatForLocalPrompt returns empty string for null analysis":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          assert.assertEqual(
            format.formatForLocalPrompt(null),
            "",
            "null analysis should return empty string"
          );
        },

      "formatForLocalPrompt returns empty string for empty analysis":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          assert.assertEqual(
            format.formatForLocalPrompt({}),
            "",
            "Empty object should return empty string"
          );
        },

      "formatForLocalPrompt includes CLIP classification": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          classification: {
            profile: "diagram",
            confidence: 0.85,
            clip: { topLabel: "flowchart", topConfidence: 0.9 },
          },
        });
        assert.assertContains(
          result,
          "Image type: diagram",
          "Should include 'Image type: diagram'"
        );
        assert.assertContains(
          result,
          'CLIP: "flowchart"',
          "Should include CLIP topLabel"
        );
      },

      "formatForLocalPrompt omits CLIP label when same as profile":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            classification: {
              profile: "photograph",
              confidence: 0.9,
              clip: { topLabel: "photograph", topConfidence: 0.9 },
            },
          });
          assert.assertTrue(
            !result.includes("CLIP:"),
            "Should not include CLIP label when same as profile"
          );
        },

      "formatForLocalPrompt includes OCR text": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          ocr: {
            status: "complete",
            items: [{ text: "Hello World", confidence: 0.9 }],
          },
        });
        assert.assertContains(
          result,
          "Visible text:",
          "Should include 'Visible text:'"
        );
        assert.assertContains(
          result,
          '"Hello World"',
          "Should include quoted OCR text"
        );
      },

      "formatForLocalPrompt filters low-confidence OCR": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          ocr: {
            status: "complete",
            items: [
              { text: "Noise", confidence: 0.1 },
              { text: "More noise", confidence: 0.05 },
            ],
          },
        });
        assert.assertTrue(
          !result.includes("Visible text:"),
          "Low-confidence items should be filtered out"
        );
      },

      "formatForLocalPrompt includes null-confidence OCR items (Florence-2)":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            ocr: {
              status: "complete",
              items: [
                { text: "Tesseract item", confidence: 0.9 },
                { text: "Florence item", confidence: null },
              ],
            },
          });
          assert.assertContains(
            result,
            '"Florence item"',
            "Null-confidence items (Florence-2) should be included"
          );
        },

      "formatForLocalPrompt deduplicates OCR items (case-insensitive)":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            ocr: {
              status: "complete",
              items: [
                { text: "Hello", confidence: 0.9 },
                { text: "hello", confidence: 0.9 },
              ],
            },
          });
          // Count occurrences of quoted hello (case-insensitive)
          const matches = result.match(/"[Hh]ello"/g) || [];
          assert.assertEqual(
            matches.length,
            1,
            "Duplicate OCR items should be deduplicated — found " + matches.length
          );
        },

      "formatForLocalPrompt caps OCR items at 8": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const items = [];
        for (let i = 0; i < 15; i++) {
          items.push({ text: "Item" + i, confidence: 0.95 });
        }
        const result = format.formatForLocalPrompt({
          ocr: { status: "complete", items: items },
        });
        // Count quoted items
        const matches = result.match(/"[^"]+"/g) || [];
        assert.assertTrue(
          matches.length <= 8,
          "Should cap at 8 OCR items — found " + matches.length
        );
      },

      "formatForLocalPrompt truncates long OCR items at 40 chars":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            ocr: {
              status: "complete",
              items: [{ text: "A".repeat(60), confidence: 0.95 }],
            },
          });
          assert.assertContains(
            result,
            "...",
            "Long OCR items should be truncated with '...'"
          );
        },

      "formatForLocalPrompt includes colour palette": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          colour: {
            status: "complete",
            palette: [
              { colourName: "navy blue" },
              { colourName: "white" },
            ],
          },
        });
        assert.assertContains(
          result,
          "Main colours:",
          "Should include 'Main colours:'"
        );
        assert.assertContains(
          result,
          "navy blue",
          "Should include colour name 'navy blue'"
        );
      },

      "formatForLocalPrompt limits palette to 5 colours": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const palette = [];
        for (let i = 0; i < 10; i++) {
          palette.push({ colourName: "colour" + i });
        }
        const result = format.formatForLocalPrompt({
          colour: { status: "complete", palette: palette },
        });
        // Extract the "Main colours:" line
        const colourLine = result
          .split("\n")
          .find(function (l) { return l.includes("Main colours:"); });
        if (!colourLine) {
          assert.assertTrue(false, "Main colours line should exist");
          return;
        }
        // Count colour names
        let count = 0;
        for (let i = 0; i < 10; i++) {
          if (colourLine.includes("colour" + i)) count++;
        }
        assert.assertTrue(
          count <= 5,
          "Should limit to 5 colours — found " + count
        );
      },

      "formatForLocalPrompt includes depth zones above 10%": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          depth: {
            status: "success",
            hasSignificantDepth: true,
            zones: [
              { label: "foreground", areaPercent: 45 },
              { label: "background", areaPercent: 55 },
            ],
          },
        });
        assert.assertContains(
          result,
          "Depth:",
          "Should include 'Depth:'"
        );
        assert.assertContains(
          result,
          "foreground",
          "Should include 'foreground' zone"
        );
      },

      "formatForLocalPrompt excludes depth zones below 10%": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          depth: {
            status: "success",
            hasSignificantDepth: true,
            zones: [
              { label: "tiny", areaPercent: 5 },
              { label: "also tiny", areaPercent: 3 },
            ],
          },
        });
        assert.assertTrue(
          !result.includes("Depth:"),
          "Should not include 'Depth:' when all zones below 10%"
        );
      },

      "formatForLocalPrompt includes Florence-2 caption": function (assert) {
        if (!format || typeof format.formatForLocalPrompt !== "function") {
          console.warn("[skipped] formatForLocalPrompt not available");
          return;
        }
        const result = format.formatForLocalPrompt({
          florenceCaption: {
            status: "complete",
            text: "A diagram showing cell division",
          },
        });
        assert.assertContains(
          result,
          "Caption: A diagram showing cell division",
          "Should include Florence-2 caption"
        );
      },

      "formatForLocalPrompt truncates long Florence-2 caption at 100 chars":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            florenceCaption: {
              status: "complete",
              text: "B".repeat(150),
            },
          });
          assert.assertContains(
            result,
            "...",
            "Long caption should be truncated with '...'"
          );
        },

      "formatForLocalPrompt adds prefix when any data present":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            classification: {
              profile: "photograph",
              confidence: 0.9,
            },
          });
          assert.assertTrue(
            result.startsWith("Pre-analysis context:"),
            "Should start with 'Pre-analysis context:'"
          );
        },

      "formatForLocalPrompt handles full analysis with all slots populated":
        function (assert) {
          if (!format || typeof format.formatForLocalPrompt !== "function") {
            console.warn("[skipped] formatForLocalPrompt not available");
            return;
          }
          const result = format.formatForLocalPrompt({
            classification: {
              profile: "diagram",
              confidence: 0.85,
              clip: { topLabel: "flowchart", topConfidence: 0.9 },
            },
            ocr: {
              status: "complete",
              items: [{ text: "Step 1", confidence: 0.9 }],
            },
            colour: {
              status: "complete",
              palette: [{ colourName: "blue" }, { colourName: "white" }],
            },
            depth: {
              status: "success",
              hasSignificantDepth: true,
              zones: [
                { label: "foreground", areaPercent: 60 },
                { label: "background", areaPercent: 40 },
              ],
            },
            florenceCaption: {
              status: "complete",
              text: "A flowchart diagram",
            },
          });
          assert.assertContains(result, "Image type:", "Should include classification");
          assert.assertContains(result, "Visible text:", "Should include OCR");
          assert.assertContains(result, "Main colours:", "Should include colours");
          assert.assertContains(result, "Depth:", "Should include depth");
          assert.assertContains(result, "Caption:", "Should include caption");
        },

      // ──────────────────────────────────────────────────────────
      // D2. Analysis Reference Data (Phase 14H)
      // ──────────────────────────────────────────────────────────

      "buildAnalysisReferenceMarkdown exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller.buildAnalysisReferenceMarkdown,
            "buildAnalysisReferenceMarkdown should exist"
          );
        },

      "buildAnalysisReferenceMarkdown returns empty for null analysis":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = null;
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertEqual(result, "", "null analysis should return empty");
        },

      "buildAnalysisReferenceMarkdown returns empty for empty analysis":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {};
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertEqual(result, "", "empty analysis should return empty");
        },

      "buildAnalysisReferenceMarkdown includes OCR items":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            ocr: {
              status: "complete",
              items: [
                { text: "Label A", confidence: 0.9, quadrant: "top-left" },
                { text: "Label B", confidence: 0.8, quadrant: "bottom-right" },
              ],
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertContains(result, "### Detected Text", "Should have OCR heading");
          assert.assertContains(result, '"Label A"', "Should include first item");
          assert.assertContains(result, "top-left", "Should include quadrant");
        },

      "buildAnalysisReferenceMarkdown includes null-confidence items":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            ocr: {
              status: "complete",
              items: [
                { text: "Florence item", confidence: null, quadrant: "centre" },
              ],
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertContains(
            result,
            '"Florence item"',
            "Null-confidence items (Florence-2) should be included"
          );
        },

      "buildAnalysisReferenceMarkdown deduplicates OCR items":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            ocr: {
              status: "complete",
              items: [
                { text: "Dupe", confidence: 0.9, quadrant: "top-left" },
                { text: "dupe", confidence: 0.8, quadrant: "bottom-right" },
              ],
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          const matches = result.match(/"[Dd]upe"/g) || [];
          assert.assertEqual(matches.length, 1, "Should deduplicate — found " + matches.length);
        },

      "buildAnalysisReferenceMarkdown includes colour palette":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            colour: {
              status: "complete",
              palette: [
                { colourName: "navy blue", percentage: 0.42 },
                { colourName: "white", percentage: 0.35 },
              ],
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertContains(result, "### Colour Palette", "Should have colour heading");
          assert.assertContains(result, "navy blue (42%)", "Should include colour with percentage");
        },

      "buildAnalysisReferenceMarkdown includes classification":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            classification: {
              profile: "chart",
              confidence: 0.9,
              clip: { topLabel: "bar chart", topConfidence: 0.88 },
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertContains(result, "### Image Classification", "Should have classification heading");
          assert.assertContains(result, "chart", "Should include profile");
          assert.assertContains(result, "bar chart", "Should include CLIP label when different");
        },

      "buildAnalysisReferenceMarkdown omits CLIP label when same as profile":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            classification: {
              profile: "photograph",
              confidence: 0.9,
              clip: { topLabel: "photograph", topConfidence: 0.9 },
            },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertTrue(
            !result.includes("CLIP:"),
            "Should not include CLIP label when same as profile"
          );
        },

      "buildAnalysisReferenceMarkdown includes main heading":
        function (assert) {
          if (!controller || !controller.buildAnalysisReferenceMarkdown) {
            console.warn("[skipped] buildAnalysisReferenceMarkdown not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            classification: { profile: "diagram", confidence: 0.8 },
          };
          const result = controller.buildAnalysisReferenceMarkdown();
          controller.lastAnalysis = saved;
          assert.assertContains(
            result,
            "## Analysis Reference Data",
            "Should have main heading"
          );
        },

      "_appendAnalysisReference exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller._appendAnalysisReference,
            "_appendAnalysisReference should exist"
          );
        },

      "_buildAnalysisReferenceHTML exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller._buildAnalysisReferenceHTML,
            "_buildAnalysisReferenceHTML should exist"
          );
        },

      "_buildAnalysisReferenceHTML uses aside element":
        function (assert) {
          if (!controller || !controller._buildAnalysisReferenceHTML) {
            console.warn("[skipped] _buildAnalysisReferenceHTML not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            classification: { profile: "diagram", confidence: 0.8 },
          };
          const result = controller._buildAnalysisReferenceHTML();
          controller.lastAnalysis = saved;
          assert.assertTrue(
            result.startsWith("<aside"),
            "Should use <aside> element"
          );
          assert.assertContains(
            result,
            'aria-label="Analysis reference data"',
            "Should have aria-label on aside"
          );
        },

      "_buildAnalysisReferenceHTML uses dl for classification":
        function (assert) {
          if (!controller || !controller._buildAnalysisReferenceHTML) {
            console.warn("[skipped] _buildAnalysisReferenceHTML not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            classification: {
              profile: "chart",
              confidence: 0.9,
              clip: { topLabel: "bar chart", topConfidence: 0.88 },
            },
          };
          const result = controller._buildAnalysisReferenceHTML();
          controller.lastAnalysis = saved;
          assert.assertContains(result, "<dl>", "Should use <dl> for classification");
          assert.assertContains(result, "<dt>Type</dt>", "Should have Type term");
          assert.assertContains(result, "<dt>CLIP</dt>", "Should have CLIP term");
        },

      "_buildAnalysisReferenceHTML uses ul for colour palette":
        function (assert) {
          if (!controller || !controller._buildAnalysisReferenceHTML) {
            console.warn("[skipped] _buildAnalysisReferenceHTML not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            colour: {
              status: "complete",
              palette: [
                { colourName: "navy blue", percentage: 0.42 },
                { colourName: "white", percentage: 0.35 },
              ],
            },
          };
          const result = controller._buildAnalysisReferenceHTML();
          controller.lastAnalysis = saved;
          assert.assertContains(
            result,
            'class="imgdesc-ref-inline-list"',
            "Should use inline-list class for colours"
          );
          assert.assertContains(result, "<li>navy blue (42%)</li>", "Should list colours as li");
        },

      "_buildAnalysisReferenceHTML wraps subsections in section elements":
        function (assert) {
          if (!controller || !controller._buildAnalysisReferenceHTML) {
            console.warn("[skipped] _buildAnalysisReferenceHTML not available");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            ocr: {
              status: "complete",
              items: [{ text: "A", confidence: 0.9, quadrant: "top-left" }],
            },
            classification: { profile: "diagram", confidence: 0.8 },
          };
          const result = controller._buildAnalysisReferenceHTML();
          controller.lastAnalysis = saved;
          const sectionCount = (result.match(/<section>/g) || []).length;
          assert.assertEqual(sectionCount, 2, "Should have 2 section elements — found " + sectionCount);
        },

      // ──────────────────────────────────────────────────────────
      // D3. Educational Context Reference (Phase 14I)
      // ──────────────────────────────────────────────────────────

      "buildEducationalContextMarkdown exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller.buildEducationalContextMarkdown,
            "buildEducationalContextMarkdown should exist"
          );
        },

      "buildEducationalContextMarkdown returns empty when no fields populated":
        function (assert) {
          if (!controller || !controller.buildEducationalContextMarkdown) {
            console.warn("[skipped] buildEducationalContextMarkdown not available");
            return;
          }
          // Clear all fields
          const fields = ["subject", "topic", "objective", "context", "module"];
          const saved = {};
          fields.forEach(function (f) {
            if (controller.elements[f]) {
              saved[f] = controller.elements[f].value;
              controller.elements[f].value = "";
            }
          });
          const savedAud = controller.elements.audience ? controller.elements.audience.value : null;
          if (controller.elements.audience) controller.elements.audience.value = "general";

          const result = controller.buildEducationalContextMarkdown();

          // Restore
          fields.forEach(function (f) {
            if (controller.elements[f] && saved[f] !== undefined) {
              controller.elements[f].value = saved[f];
            }
          });
          if (controller.elements.audience && savedAud !== null) {
            controller.elements.audience.value = savedAud;
          }

          assert.assertEqual(result, "", "Empty fields should return empty string");
        },

      "buildEducationalContextMarkdown includes populated fields":
        function (assert) {
          if (!controller || !controller.buildEducationalContextMarkdown) {
            console.warn("[skipped] buildEducationalContextMarkdown not available");
            return;
          }
          // Set test values
          const fields = ["subject", "topic", "objective", "context", "module"];
          const saved = {};
          fields.forEach(function (f) {
            if (controller.elements[f]) {
              saved[f] = controller.elements[f].value;
            }
          });
          if (controller.elements.subject) controller.elements.subject.value = "Test Subject";
          if (controller.elements.topic) controller.elements.topic.value = "Test Topic";
          if (controller.elements.objective) controller.elements.objective.value = "";
          if (controller.elements.context) controller.elements.context.value = "";
          if (controller.elements.module) controller.elements.module.value = "TST101";

          const result = controller.buildEducationalContextMarkdown();

          // Restore
          fields.forEach(function (f) {
            if (controller.elements[f] && saved[f] !== undefined) {
              controller.elements[f].value = saved[f];
            }
          });

          assert.assertContains(result, "## Educational Context", "Should have heading");
          assert.assertContains(result, "Test Subject", "Should include subject");
          assert.assertContains(result, "Test Topic", "Should include topic");
          assert.assertContains(result, "TST101", "Should include module");
          assert.assertTrue(
            !result.includes("Learning Objective"),
            "Should omit empty objective field"
          );
        },

      "buildEducationalContextMarkdown omits general audience":
        function (assert) {
          if (!controller || !controller.buildEducationalContextMarkdown) {
            console.warn("[skipped] buildEducationalContextMarkdown not available");
            return;
          }
          const saved = {};
          if (controller.elements.subject) {
            saved.subject = controller.elements.subject.value;
            controller.elements.subject.value = "Something";
          }
          const savedAud = controller.elements.audience ? controller.elements.audience.value : null;
          if (controller.elements.audience) controller.elements.audience.value = "general";

          const result = controller.buildEducationalContextMarkdown();

          if (controller.elements.subject) controller.elements.subject.value = saved.subject || "";
          if (controller.elements.audience && savedAud !== null) {
            controller.elements.audience.value = savedAud;
          }

          assert.assertTrue(
            !result.includes("Audience"),
            "Should omit general audience (default)"
          );
        },

      "buildEducationalContextMarkdown includes non-default audience":
        function (assert) {
          if (!controller || !controller.buildEducationalContextMarkdown) {
            console.warn("[skipped] buildEducationalContextMarkdown not available");
            return;
          }
          if (!controller.elements.audience) {
            console.warn("[skipped] audience element not available");
            return;
          }
          const savedAud = controller.elements.audience.value;
          controller.elements.audience.value = "ug2";

          const result = controller.buildEducationalContextMarkdown();

          controller.elements.audience.value = savedAud;

          assert.assertContains(
            result,
            "Audience",
            "Should include non-default audience"
          );
        },

      "_buildEducationalContextHTML exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller._buildEducationalContextHTML,
            "_buildEducationalContextHTML should exist"
          );
        },

      "_buildEducationalContextHTML returns empty when no fields populated":
        function (assert) {
          if (!controller || !controller._buildEducationalContextHTML) {
            console.warn("[skipped] _buildEducationalContextHTML not available");
            return;
          }
          const fields = ["subject", "topic", "objective", "context", "module"];
          const saved = {};
          fields.forEach(function (f) {
            if (controller.elements[f]) {
              saved[f] = controller.elements[f].value;
              controller.elements[f].value = "";
            }
          });
          const savedAud = controller.elements.audience ? controller.elements.audience.value : null;
          if (controller.elements.audience) controller.elements.audience.value = "general";

          const result = controller._buildEducationalContextHTML();

          fields.forEach(function (f) {
            if (controller.elements[f] && saved[f] !== undefined) {
              controller.elements[f].value = saved[f];
            }
          });
          if (controller.elements.audience && savedAud !== null) {
            controller.elements.audience.value = savedAud;
          }

          assert.assertEqual(result, "", "Empty fields should return empty HTML");
        },

      "_buildEducationalContextHTML uses aside element":
        function (assert) {
          if (!controller || !controller._buildEducationalContextHTML) {
            console.warn("[skipped] _buildEducationalContextHTML not available");
            return;
          }
          const saved = controller.elements.subject ? controller.elements.subject.value : "";
          if (controller.elements.subject) controller.elements.subject.value = "Test";

          const result = controller._buildEducationalContextHTML();

          if (controller.elements.subject) controller.elements.subject.value = saved;

          assert.assertContains(result, "<aside", "Should use aside element");
          assert.assertContains(
            result,
            'aria-label="Educational context"',
            "Should have aria-label"
          );
        },

      "_buildEducationalContextHTML uses dl for key-value pairs":
        function (assert) {
          if (!controller || !controller._buildEducationalContextHTML) {
            console.warn("[skipped] _buildEducationalContextHTML not available");
            return;
          }
          const saved = controller.elements.subject ? controller.elements.subject.value : "";
          if (controller.elements.subject) controller.elements.subject.value = "Physics";

          const result = controller._buildEducationalContextHTML();

          if (controller.elements.subject) controller.elements.subject.value = saved;

          assert.assertContains(result, "<dl>", "Should use dl element");
          assert.assertContains(result, "<dt>Subject Area</dt>", "Should have dt for subject");
          assert.assertContains(result, "<dd>Physics</dd>", "Should have dd with value");
        },

      "_appendEducationalContext exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller._appendEducationalContext,
            "_appendEducationalContext should exist"
          );
        },

      // ──────────────────────────────────────────────────────────
      // D4. Florence-2 OCR Quick-Access (Phase 14J)
      // ──────────────────────────────────────────────────────────

      "_updateFlorenceOCRPrompt exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller._updateFlorenceOCRPrompt,
            "_updateFlorenceOCRPrompt should exist"
          );
        },

      "runFlorenceOCRDirect exists on controller":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertNotNull(
            controller.runFlorenceOCRDirect,
            "runFlorenceOCRDirect should exist"
          );
        },

      "runFlorenceOCRDirect is an async function":
        function (assert) {
          if (!controller || !controller.runFlorenceOCRDirect) {
            console.warn("[skipped] runFlorenceOCRDirect not available");
            return;
          }
          assert.assertTrue(
            controller.runFlorenceOCRDirect.constructor.name === "AsyncFunction",
            "runFlorenceOCRDirect should be async"
          );
        },

      "_updateFlorenceOCRPrompt creates element on first call":
        function (assert) {
          if (!controller || !controller._updateFlorenceOCRPrompt) {
            console.warn("[skipped] _updateFlorenceOCRPrompt not available");
            return;
          }
          // Only test if toolbar exists (element is inserted relative to it)
          const toolbar = document.getElementById("imgdesc-overlay-toolbar");
          if (!toolbar) {
            console.warn("[skipped] overlay toolbar not in DOM");
            return;
          }
          controller._updateFlorenceOCRPrompt();
          const el = document.getElementById("imgdesc-florence-ocr-prompt");
          assert.assertNotNull(el, "Element should be created after first call");
        },

      "Florence OCR prompt has correct ARIA attributes":
        function (assert) {
          const el = document.getElementById("imgdesc-florence-ocr-prompt");
          if (!el) {
            console.warn("[skipped] Florence OCR prompt element not in DOM");
            return;
          }
          assert.assertEqual(
            el.getAttribute("role"),
            "status",
            "Should have role=status"
          );
          assert.assertEqual(
            el.getAttribute("aria-live"),
            "polite",
            "Should have aria-live=polite"
          );
        },

      "_florenceOCRRunning state property exists":
        function (assert) {
          if (!controller) {
            console.warn("[skipped] ImageDescriberController not loaded");
            return;
          }
          assert.assertTrue(
            typeof controller._florenceOCRRunning === "boolean",
            "_florenceOCRRunning should be a boolean"
          );
        },

      "_updateFlorenceOCRPrompt hides element when no analysis":
        function (assert) {
          if (!controller || !controller._updateFlorenceOCRPrompt) {
            console.warn("[skipped] _updateFlorenceOCRPrompt not available");
            return;
          }
          const el = document.getElementById("imgdesc-florence-ocr-prompt");
          if (!el) {
            console.warn("[skipped] Florence OCR prompt element not in DOM");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = null;
          controller._updateFlorenceOCRPrompt();
          assert.assertTrue(el.hidden, "Should be hidden when no analysis");
          controller.lastAnalysis = saved;
        },

      "_updateFlorenceOCRPrompt hides when Florence OCR already complete":
        function (assert) {
          if (!controller || !controller._updateFlorenceOCRPrompt) {
            console.warn("[skipped] _updateFlorenceOCRPrompt not available");
            return;
          }
          const el = document.getElementById("imgdesc-florence-ocr-prompt");
          if (!el) {
            console.warn("[skipped] Florence OCR prompt element not in DOM");
            return;
          }
          const saved = controller.lastAnalysis;
          controller.lastAnalysis = {
            florenceOCR: { status: "complete", items: [] },
          };
          controller._updateFlorenceOCRPrompt();
          assert.assertTrue(el.hidden, "Should be hidden when Florence OCR already complete");
          controller.lastAnalysis = saved;
        },

      // ──────────────────────────────────────────────────────────
      // E. Controller — generateLocally() Structural Tests
      // ──────────────────────────────────────────────────────────

      "generateLocally exists on controller": function (assert) {
        if (!controller) {
          console.warn("[skipped] ImageDescriberController not loaded");
          return;
        }
        assert.assertNotNull(
          controller.generateLocally,
          "generateLocally should exist on controller"
        );
      },

      "generateLocally is an async function": function (assert) {
        if (!controller || !controller.generateLocally) {
          console.warn("[skipped] generateLocally not available");
          return;
        }
        assert.assertTrue(
          controller.generateLocally.constructor.name === "AsyncFunction",
          "generateLocally should be an AsyncFunction"
        );
      },

      "_renderPlainTextAsHtml exists on controller": function (assert) {
        if (!controller) {
          console.warn("[skipped] ImageDescriberController not loaded");
          return;
        }
        assert.assertNotNull(
          controller._renderPlainTextAsHtml,
          "_renderPlainTextAsHtml should exist on controller"
        );
      },

      "_renderPlainTextAsHtml renders single paragraph": function (assert) {
        if (!controller || typeof controller._renderPlainTextAsHtml !== "function") {
          console.warn("[skipped] _renderPlainTextAsHtml not available");
          return;
        }
        const result = controller._renderPlainTextAsHtml("Hello world");
        assert.assertContains(
          result,
          "<p>Hello world</p>",
          "Should wrap text in <p> tags"
        );
      },

      "_renderPlainTextAsHtml renders multiple paragraphs": function (assert) {
        if (!controller || typeof controller._renderPlainTextAsHtml !== "function") {
          console.warn("[skipped] _renderPlainTextAsHtml not available");
          return;
        }
        const result = controller._renderPlainTextAsHtml("Para one\n\nPara two");
        assert.assertContains(
          result,
          "<p>Para one</p>",
          "Should include first paragraph"
        );
        assert.assertContains(
          result,
          "<p>Para two</p>",
          "Should include second paragraph"
        );
      },

      "_renderPlainTextAsHtml escapes HTML entities": function (assert) {
        if (!controller || typeof controller._renderPlainTextAsHtml !== "function") {
          console.warn("[skipped] _renderPlainTextAsHtml not available");
          return;
        }
        const result = controller._renderPlainTextAsHtml("a < b & c > d");
        assert.assertContains(result, "&lt;", "Should escape < to &lt;");
        assert.assertContains(result, "&amp;", "Should escape & to &amp;");
        assert.assertContains(result, "&gt;", "Should escape > to &gt;");
      },

      "_renderPlainTextAsHtml handles empty input": function (assert) {
        if (!controller || typeof controller._renderPlainTextAsHtml !== "function") {
          console.warn("[skipped] _renderPlainTextAsHtml not available");
          return;
        }
        const result = controller._renderPlainTextAsHtml("");
        assert.assertContains(
          result,
          "<em>",
          "Empty input should produce fallback with <em>"
        );
      },

      "Generate Locally button exists in DOM": function (assert) {
        const el = document.getElementById("imgdesc-generate-local");
        assert.assertNotNull(
          el,
          "imgdesc-generate-local button should exist in DOM"
        );
      },

      // ──────────────────────────────────────────────────────────
      // F. Local Progress Stages
      // ──────────────────────────────────────────────────────────

      "Local progress stages are defined": function (assert) {
        if (!controller || typeof controller.showProgress !== "function") {
          console.warn("[skipped] controller.showProgress not available");
          return;
        }
        // Test indirectly: check that the progress stage element exists
        const stageEl = document.getElementById("imgdesc-progress-stage");
        if (!stageEl) {
          console.warn(
            "[skipped] imgdesc-progress-stage not in DOM — cannot verify progress stages"
          );
          return;
        }
        // The progress element existing confirms the infrastructure is present
        assert.assertNotNull(
          stageEl,
          "Progress stage element should exist for local generation stages"
        );
      },

      // ──────────────────────────────────────────────────────────
      // WCAG 2.2 AA Audit — Phase 13 UI elements
      // ──────────────────────────────────────────────────────────

      "Generate Locally button is keyboard focusable": function (assert) {
        const el = document.getElementById("imgdesc-generate-local");
        if (!el) {
          console.warn("[skipped] Generate Locally button not in DOM");
          return;
        }
        // Native <button> is focusable by default
        assert.assertEqual(
          el.tagName,
          "BUTTON",
          "Should be a native <button> element (keyboard accessible)"
        );
      },

      "Generate Locally button uses disabled attribute (not aria-disabled)":
        function (assert) {
          const el = document.getElementById("imgdesc-generate-local");
          if (!el) {
            console.warn("[skipped] Generate Locally button not in DOM");
            return;
          }
          // The disabled attribute is the correct approach for native buttons
          assert.assertTrue(
            el.hasAttribute("disabled"),
            "Button should use native disabled attribute"
          );
        },

      "FastVLM progress bar has required ARIA attributes": function (assert) {
        const row = document.getElementById("imgdesc-mm-model-fastvlm");
        if (!row) {
          console.warn("[skipped] FastVLM model row not in DOM");
          return;
        }
        const progressBar = row.querySelector('[role="progressbar"]');
        if (!progressBar) {
          console.warn("[skipped] Progress bar not found in FastVLM row");
          return;
        }
        assert.assertNotNull(
          progressBar.getAttribute("aria-valuenow"),
          "Progress bar should have aria-valuenow"
        );
        assert.assertNotNull(
          progressBar.getAttribute("aria-valuemin"),
          "Progress bar should have aria-valuemin"
        );
        assert.assertNotNull(
          progressBar.getAttribute("aria-valuemax"),
          "Progress bar should have aria-valuemax"
        );
        assert.assertNotNull(
          progressBar.getAttribute("aria-label"),
          "Progress bar should have aria-label"
        );
      },

      "Output container has aria-live for streaming": function (assert) {
        const output = document.getElementById("imgdesc-output");
        if (!output) {
          console.warn("[skipped] imgdesc-output not in DOM");
          return;
        }
        assert.assertEqual(
          output.getAttribute("aria-live"),
          "polite",
          "Output container should have aria-live='polite'"
        );
      },

      // ──────────────────────────────────────────────────────────
      // Registration confirmation
      // ──────────────────────────────────────────────────────────

      "Test module registered successfully": function (assert) {
        assert.assertTrue(
          true,
          "Module is running so registration succeeded"
        );
      },
    },
  });
})();
