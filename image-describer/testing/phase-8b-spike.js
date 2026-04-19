// Phase 8B — Model Validation Spike
// Paste into browser console with Image Describer loaded and an image uploaded.
// Tests Florence-2 and Depth Anything V2 in Transformers.js v3.8.1.
// This is a throwaway research script — no production code changes.
(async function phase8bSpike() {
    'use strict';

    // ── Helpers ──────────────────────────────────────────────────────────
    const results = [];
    const fmt = (ms) => `${ms.toFixed(0)} ms`;

    function logResult(name, data) {
        results.push({ name, ...data });
        console.log(`\n${'═'.repeat(60)}`);
        console.log(`TEST: ${name}`);
        console.log('═'.repeat(60));
        Object.entries(data).forEach(([k, v]) => {
            if (k === 'rawOutput' || k === 'error') {
                console.log(`  ${k}:`);
                console.log(v);
            } else {
                console.log(`  ${k}: ${v}`);
            }
        });
    }

    // ── Pre-flight checks ───────────────────────────────────────────────
    if (typeof ImageDescriberAnalyserTransformers === 'undefined') {
        console.error('ImageDescriberAnalyserTransformers not found. Is Image Describer loaded?');
        return;
    }

    // The preview container is #imgdesc-preview; the <img> inside has class "imgdesc-preview-image"
    const previewContainer = document.getElementById('imgdesc-preview');
    const previewImg = previewContainer
        ? previewContainer.querySelector('img.imgdesc-preview-image') || previewContainer.querySelector('img')
        : null;
    if (!previewImg || !previewImg.src || previewImg.src === '') {
        console.error('Upload an image first, then run this script.');
        console.log('Debug: container found =', !!previewContainer);
        if (previewContainer) {
            console.log('Debug: container innerHTML preview =', previewContainer.innerHTML.substring(0, 200));
        }
        return;
    }

    console.log('Phase 8B Spike — starting model validation...');
    console.log(`Image source: ${previewImg.src.substring(0, 80)}...`);
    console.log(`Image dimensions: ${previewImg.naturalWidth} × ${previewImg.naturalHeight}`);

    // ── Get Transformers.js library reference ────────────────────────────
    let lib;
    try {
        lib = await ImageDescriberAnalyserTransformers.ensureLibrary();
        console.log('Transformers.js library loaded successfully.');
    } catch (err) {
        console.error('Failed to load Transformers.js:', err);
        return;
    }

    // ── Prepare image as RawImage ────────────────────────────────────────
    // Convert preview image to a canvas, then to a data URL for RawImage.read()
    let imageDataUrl;
    try {
        const canvas = document.createElement('canvas');
        canvas.width = previewImg.naturalWidth;
        canvas.height = previewImg.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(previewImg, 0, 0);
        imageDataUrl = canvas.toDataURL('image/png');
        console.log(`Image converted to data URL (${(imageDataUrl.length / 1024).toFixed(0)} KB base64)`);
    } catch (err) {
        console.error('Failed to convert image to data URL:', err);
        return;
    }

    // ══════════════════════════════════════════════════════════════════════
    // FLORENCE-2 TESTS
    // ══════════════════════════════════════════════════════════════════════
    const FLORENCE_MODEL_ID = 'onnx-community/Florence-2-base-ft';
    let florenceModel = null;
    let florenceProcessor = null;
    let florenceTokenizer = null;
    let florenceRawImage = null;

    // ── Florence-2: Load model ───────────────────────────────────────────
    console.log('\n\nLoading Florence-2 model, processor, and tokenizer...');
    console.log('This will download ~200 MB on first load. Please wait.');

    const florenceLoadStart = performance.now();
    try {
        // Florence-2 is an encoder-decoder model — it needs explicit loading,
        // NOT pipeline(). Check which classes are available in this build.
        const hasFlorence2Class = typeof lib.Florence2ForConditionalGeneration === 'function';
        const hasAutoProcessor = typeof lib.AutoProcessor === 'function';
        const hasAutoTokenizer = typeof lib.AutoTokenizer === 'function';
        const hasRawImage = typeof lib.RawImage === 'function';

        console.log('Available classes:');
        console.log(`  Florence2ForConditionalGeneration: ${hasFlorence2Class}`);
        console.log(`  AutoProcessor: ${hasAutoProcessor}`);
        console.log(`  AutoTokenizer: ${hasAutoTokenizer}`);
        console.log(`  RawImage: ${hasRawImage}`);

        if (!hasFlorence2Class) {
            throw new Error(
                'Florence2ForConditionalGeneration not found in Transformers.js. ' +
                'This model may not be supported in v3.8.1.'
            );
        }
        if (!hasAutoProcessor) {
            throw new Error('AutoProcessor not found in Transformers.js.');
        }

        // Load all three components in parallel
        const loadPromises = [
            lib.Florence2ForConditionalGeneration.from_pretrained(FLORENCE_MODEL_ID, {
                dtype: 'fp32',
                progress_callback: (progress) => {
                    if (progress.status === 'progress' && progress.progress) {
                        console.log(`  Model download: ${progress.file} — ${progress.progress.toFixed(1)}%`);
                    }
                }
            }),
            lib.AutoProcessor.from_pretrained(FLORENCE_MODEL_ID),
        ];

        // Tokenizer is optional — some patterns use processor.batch_decode instead
        if (hasAutoTokenizer) {
            loadPromises.push(lib.AutoTokenizer.from_pretrained(FLORENCE_MODEL_ID));
        }

        const loadResults = await Promise.all(loadPromises);
        florenceModel = loadResults[0];
        florenceProcessor = loadResults[1];
        florenceTokenizer = loadResults[2] || null;

        const florenceLoadTime = performance.now() - florenceLoadStart;

        // Prepare the RawImage once for all Florence tests
        florenceRawImage = await lib.RawImage.read(imageDataUrl);

        logResult('Florence-2 Load', {
            status: 'SUCCESS',
            modelId: FLORENCE_MODEL_ID,
            loadTime: fmt(florenceLoadTime),
            hasTokenizer: !!florenceTokenizer,
            imageSize: `${florenceRawImage.width} × ${florenceRawImage.height}`,
        });

    } catch (err) {
        const florenceLoadTime = performance.now() - florenceLoadStart;
        logResult('Florence-2 Load', {
            status: 'FAILED',
            modelId: FLORENCE_MODEL_ID,
            loadTime: fmt(florenceLoadTime),
            error: err,
        });
        console.error('Florence-2 load failed — skipping all Florence tests.');
    }

    // ── Helper: run a Florence-2 task ────────────────────────────────────
    async function runFlorenceTask(taskToken, testName) {
        if (!florenceModel || !florenceProcessor || !florenceRawImage) {
            logResult(testName, { status: 'SKIPPED', reason: 'Florence-2 not loaded' });
            return;
        }

        const inferStart = performance.now();
        try {
            // Build inputs — try the processor-handles-everything pattern first
            const prompts = florenceProcessor.construct_prompts(taskToken);
            console.log(`  Constructed prompt for ${taskToken}: "${prompts}"`);

            let inputs;
            let generatedIds;

            if (florenceTokenizer) {
                // Pattern: separate tokenizer + vision processor
                const visionInputs = await florenceProcessor(florenceRawImage);
                const textInputs = florenceTokenizer(prompts);

                generatedIds = await florenceModel.generate({
                    ...textInputs,
                    ...visionInputs,
                    max_new_tokens: 256,
                    num_beams: 1,
                    do_sample: false,
                });
            } else {
                // Pattern: processor handles both image and text
                inputs = await florenceProcessor(florenceRawImage, prompts);

                generatedIds = await florenceModel.generate({
                    ...inputs,
                    max_new_tokens: 256,
                });
            }

            // Decode
            const decoder = florenceTokenizer || florenceProcessor;
            const generatedText = decoder.batch_decode(generatedIds, {
                skip_special_tokens: false,
            })[0];

            // Post-process to structured output
            const postProcessed = florenceProcessor.post_process_generation(
                generatedText,
                taskToken,
                florenceRawImage.size // [width, height]
            );

            const inferTime = performance.now() - inferStart;

            logResult(testName, {
                status: 'SUCCESS',
                task: taskToken,
                inferenceTime: fmt(inferTime),
                rawGeneratedText: generatedText,
                rawOutput: postProcessed,
            });

            // Extra logging for structured outputs
            if (postProcessed[taskToken]) {
                const output = postProcessed[taskToken];
                if (output.bboxes) {
                    console.log(`  Bounding boxes found: ${output.bboxes.length}`);
                    console.log(`  Labels: ${JSON.stringify(output.labels)}`);
                    console.log(`  First bbox format: ${JSON.stringify(output.bboxes[0])}`);
                }
                if (output.quad_boxes) {
                    console.log(`  OCR regions found: ${output.quad_boxes.length}`);
                    console.log(`  OCR labels: ${JSON.stringify(output.labels)}`);
                    console.log(`  First quad_box format: ${JSON.stringify(output.quad_boxes[0])}`);
                }
            }

        } catch (err) {
            const inferTime = performance.now() - inferStart;
            logResult(testName, {
                status: 'FAILED',
                task: taskToken,
                inferenceTime: fmt(inferTime),
                error: err,
            });
        }
    }

    // ── Test 1: Florence-2 <DETAILED_CAPTION> ────────────────────────────
    console.log('\n\n── Test 1: Florence-2 <DETAILED_CAPTION> ──');
    await runFlorenceTask('<DETAILED_CAPTION>', 'Florence-2 DETAILED_CAPTION');

    // ── Test 2: Florence-2 <OD> (Object Detection) ──────────────────────
    console.log('\n\n── Test 2: Florence-2 <OD> ──');
    await runFlorenceTask('<OD>', 'Florence-2 OD (Object Detection)');

    // ── Test 3: Florence-2 <OCR_WITH_REGION> ─────────────────────────────
    console.log('\n\n── Test 3: Florence-2 <OCR_WITH_REGION> ──');
    await runFlorenceTask('<OCR_WITH_REGION>', 'Florence-2 OCR_WITH_REGION');

    // ── Test 4: Florence-2 <MORE_DETAILED_CAPTION> ──────────────────────
    console.log('\n\n── Test 4: Florence-2 <MORE_DETAILED_CAPTION> ──');
    await runFlorenceTask('<MORE_DETAILED_CAPTION>', 'Florence-2 MORE_DETAILED_CAPTION');

    // ── Clean up Florence-2 ──────────────────────────────────────────────
    try {
        if (florenceModel && typeof florenceModel.dispose === 'function') {
            await florenceModel.dispose();
        }
        florenceModel = null;
        florenceProcessor = null;
        florenceTokenizer = null;
        florenceRawImage = null;
        console.log('\nFlorence-2 model disposed.');
    } catch (err) {
        console.warn('Florence-2 cleanup warning:', err);
    }


    // ══════════════════════════════════════════════════════════════════════
    // DEPTH ANYTHING V2 TEST
    // ══════════════════════════════════════════════════════════════════════
    const DEPTH_MODEL_ID = 'onnx-community/depth-anything-v2-small';

    console.log('\n\n── Test 5: Depth Anything V2 Small ──');
    console.log('Loading depth estimation pipeline...');

    const depthLoadStart = performance.now();
    try {
        // Depth Anything V2 uses the simple pipeline() API
        const hasPipeline = typeof lib.pipeline === 'function';
        console.log(`  pipeline() available: ${hasPipeline}`);

        if (!hasPipeline) {
            throw new Error('pipeline() not found in Transformers.js library.');
        }

        const depthEstimator = await lib.pipeline('depth-estimation', DEPTH_MODEL_ID, {
            progress_callback: (progress) => {
                if (progress.status === 'progress' && progress.progress) {
                    console.log(`  Depth model download: ${progress.file} — ${progress.progress.toFixed(1)}%`);
                }
            }
        });

        const depthLoadTime = performance.now() - depthLoadStart;
        console.log(`  Depth model loaded in ${fmt(depthLoadTime)}`);

        // Run inference
        const inferStart = performance.now();
        const depthOutput = await depthEstimator(imageDataUrl);
        const depthInferTime = performance.now() - inferStart;

        // Inspect output structure
        const outputKeys = Object.keys(depthOutput);
        const hasPredictedDepth = !!depthOutput.predicted_depth;
        const hasDepthImage = !!depthOutput.depth;

        logResult('Depth Anything V2 Small', {
            status: 'SUCCESS',
            modelId: DEPTH_MODEL_ID,
            loadTime: fmt(depthLoadTime),
            inferenceTime: fmt(depthInferTime),
            outputKeys: JSON.stringify(outputKeys),
            hasPredictedDepth: hasPredictedDepth,
            hasDepthImage: hasDepthImage,
            rawOutput: depthOutput,
        });

        // Log tensor details if available
        if (hasPredictedDepth) {
            const tensor = depthOutput.predicted_depth;
            console.log('  predicted_depth tensor details:');
            console.log(`    type: ${tensor.type || typeof tensor}`);
            console.log(`    dims/shape: ${JSON.stringify(tensor.dims || tensor.shape)}`);
            console.log(`    data type: ${tensor.data?.constructor?.name}`);
            console.log(`    data length: ${tensor.data?.length}`);
            // Log min/max depth values
            if (tensor.data) {
                let min = Infinity, max = -Infinity;
                for (let i = 0; i < tensor.data.length; i++) {
                    if (tensor.data[i] < min) min = tensor.data[i];
                    if (tensor.data[i] > max) max = tensor.data[i];
                }
                console.log(`    depth range: ${min.toFixed(4)} — ${max.toFixed(4)}`);
            }
        }

        if (hasDepthImage) {
            const depthImg = depthOutput.depth;
            console.log('  depth RawImage details:');
            console.log(`    width: ${depthImg.width}`);
            console.log(`    height: ${depthImg.height}`);
            console.log(`    channels: ${depthImg.channels}`);
            console.log(`    data type: ${depthImg.data?.constructor?.name}`);

            // Render depth map to a visible canvas for visual inspection
            try {
                const depthCanvas = depthImg.toCanvas();
                depthCanvas.style.cssText = 'position:fixed;bottom:10px;right:10px;z-index:99999;border:3px solid red;max-width:300px;max-height:300px;';
                depthCanvas.id = 'phase8b-depth-preview';
                // Remove any previous preview
                const existing = document.getElementById('phase8b-depth-preview');
                if (existing) existing.remove();
                document.body.appendChild(depthCanvas);
                console.log('  Depth map rendered to bottom-right corner (red border). Click to remove.');
                depthCanvas.addEventListener('click', () => depthCanvas.remove());
            } catch (renderErr) {
                console.warn('  Could not render depth preview:', renderErr);
            }
        }

        // Clean up pipeline
        if (typeof depthEstimator.dispose === 'function') {
            await depthEstimator.dispose();
        }

    } catch (err) {
        const depthLoadTime = performance.now() - depthLoadStart;
        logResult('Depth Anything V2 Small', {
            status: 'FAILED',
            modelId: DEPTH_MODEL_ID,
            loadTime: fmt(depthLoadTime),
            error: err,
        });
    }


    // ══════════════════════════════════════════════════════════════════════
    // SUMMARY TABLE
    // ══════════════════════════════════════════════════════════════════════
    console.log('\n\n');
    console.log('═'.repeat(60));
    console.log('PHASE 8B — SUMMARY');
    console.log('═'.repeat(60));
    console.table(results.map(r => ({
        Test: r.name,
        Status: r.status,
        'Load Time': r.loadTime || '—',
        'Infer Time': r.inferenceTime || '—',
    })));

    console.log('\n── Key Questions ──');
    const florenceLoaded = results.find(r => r.name === 'Florence-2 Load');
    const depthResult = results.find(r => r.name === 'Depth Anything V2 Small');

    console.log(`Q1: Does Florence-2 need AutoModel+Processor (not pipeline)?`);
    console.log(`  → YES — uses Florence2ForConditionalGeneration + AutoProcessor + AutoTokenizer`);
    console.log(`  → Load result: ${florenceLoaded?.status || 'NOT RUN'}`);

    console.log(`Q2: How do you pass task tokens?`);
    console.log(`  → processor.construct_prompts('<TASK_TOKEN>') then tokenizer(prompts)`);

    console.log(`Q3: Does Florence-2 <OD> return structured bboxes?`);
    const odResult = results.find(r => r.name === 'Florence-2 OD (Object Detection)');
    console.log(`  → ${odResult?.status || 'NOT RUN'} — check rawOutput above for format`);

    console.log(`Q4: Florence-2 download size?`);
    console.log(`  → Check Network tab in DevTools for total transfer size`);

    console.log(`Q5: Does depth-anything-v2-small exist and load?`);
    console.log(`  → ${depthResult?.status || 'NOT RUN'}`);

    console.log(`Q6: Depth output format?`);
    console.log(`  → ${depthResult?.status === 'SUCCESS' ? 'Check rawOutput above — expected: { predicted_depth: Tensor, depth: RawImage }' : 'Could not determine'}`);

    console.log('\n── Next Steps ──');
    console.log('1. Copy this entire console output and paste it back to Claude Code');
    console.log('2. Note the Network tab transfer sizes for each model');
    console.log('3. Click the depth preview (bottom-right, red border) to dismiss it');
    console.log('\nPhase 8B spike complete.');

})();
