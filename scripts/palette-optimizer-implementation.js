/**
 * Palette Optimization Enhancement
 * 
 * This module extends the CVD Contrast Checker with functionality to automatically
 * optimize an entire palette to meet contrast requirements with a selected background.
 * 
 * Features include:
 * - Bulk contrast analysis against a background colour
 * - Intelligent colour adjustment to meet target contrast while preserving visual similarity
 * - Visual comparison between original and optimized colours
 * - Ability to apply changes selectively or all at once
 * - Statistics on contrast improvements
 * 
 * @requires chroma.js
 * @author University Web Accessibility Team
 */

/**
 * Initialize the palette optimization functionality
 * This adds the necessary UI elements and event listeners
 */
function initPaletteOptimizer() {
    console.log('Initializing palette optimizer...');
    
    // Add the optimizer button to each background selector
    addOptimizerButtons();
    
    // Initialize the modal for showing optimization results
    createOptimizationModal();
    
    console.log('Palette optimizer initialization complete');
}

/**
 * Add optimizer buttons to each background selector
 * These buttons trigger the palette optimization process
 */
function addOptimizerButtons() {
    document.querySelectorAll('.background-selector').forEach(selector => {
        const section = selector.getAttribute('data-section');
        const controlsContainer = selector.querySelector('.background-options');
        
        // Check if the button already exists
        if (!controlsContainer.querySelector('.optimize-palette-button')) {
            const optimizeButton = document.createElement('button');
            optimizeButton.className = 'optimize-palette-button';
            optimizeButton.textContent = 'Optimize All Colours';
            optimizeButton.setAttribute('aria-label', 'Optimize all colours for contrast');
            optimizeButton.style.display = 'none'; // Initially hidden
            
            // Add click event listener
            optimizeButton.addEventListener('click', function() {
                const backgroundPicker = controlsContainer.querySelector('.background-colour-picker');
                const targetRadio = controlsContainer.querySelector('.contrast-target-radio:checked');
                
                if (backgroundPicker && targetRadio) {
                    const backgroundColor = backgroundPicker.value;
                    const targetContrast = parseFloat(targetRadio.value);
                    optimizePalette(section, backgroundColor, targetContrast);
                }
            });
            
            // Add the button immediately after the background picker for better visibility
            const backgroundPicker = controlsContainer.querySelector('.background-picker');
            if (backgroundPicker) {
                // Create a container for the button to ensure proper spacing
                const buttonContainer = document.createElement('div');
                buttonContainer.className = 'optimize-button-container';
                buttonContainer.style.margin = '0.5rem 0';
                buttonContainer.appendChild(optimizeButton);
                
                backgroundPicker.after(buttonContainer);
            } else {
                // Fallback to adding after display mode selector
                const displayModeSelector = controlsContainer.querySelector('.display-mode-selector');
                if (displayModeSelector) {
                    displayModeSelector.after(optimizeButton);
                } else {
                    controlsContainer.appendChild(optimizeButton);
                }
            }
            
            // Show the button when background is enabled
            const checkbox = controlsContainer.querySelector('.enable-background-checkbox');
            if (checkbox) {
                checkbox.addEventListener('change', function() {
                    optimizeButton.style.display = this.checked ? 'block' : 'none';
                });
                
                // Set initial state - if background picker is visible, show the button too
                const backgroundPickerVisible = 
                    controlsContainer.querySelector('.background-picker')?.style.display !== 'none';
                
                if (checkbox.checked || backgroundPickerVisible) {
                    optimizeButton.style.display = 'block';
                }
            }
        }
    });
}

/**
 * Create the modal for displaying optimization results
 * This modal shows before/after comparison and allows selective application of changes
 * Uses the native HTML dialog element for improved accessibility
 */
function createOptimizationModal() {
    // Check if modal already exists
    if (!document.getElementById('optimization-modal')) {
        const modal = document.createElement('dialog');
        modal.id = 'optimization-modal';
        modal.className = 'optimization-modal';
        modal.setAttribute('aria-labelledby', 'optimization-modal-title');
        
        // Create modal content
        modal.innerHTML = `
            <div class="optimization-modal-content">
                <div class="optimization-modal-header">
                    <h3 id="optimization-modal-title">Palette Optimization Results</h3>
                    <button class="close-modal-button" aria-label="Close modal">×</button>
                </div>
                <div class="optimization-modal-body">
                    <div id="optimization-summary" class="optimization-summary"></div>
                    <div class="table-container">
                        <table id="optimization-results-table" class="optimization-results-table">
                            <caption class="sr-only">Comparison of original and optimized colours</caption>
                            <thead>
                                <tr>
                                    <th scope="col">Original Colour</th>
                                    <th scope="col">Optimized Colour</th>
                                    <th scope="col">Original Contrast</th>
                                    <th scope="col">New Contrast</th>
                                    <th scope="col">Similarity</th>
                                    <th scope="col">Actions</th>
                                </tr>
                            </thead>
                            <tbody id="optimization-results-body"></tbody>
                        </table>
                    </div>
                </div>
                <div class="optimization-modal-footer">
                    <div class="optimization-settings">
                        <label for="optimization-priority">Optimization priority:</label>
                        <select id="optimization-priority">
                            <option value="balanced" selected>Balanced (contrast vs. similarity)</option>
                            <option value="contrast">Maximise contrast</option>
                            <option value="similarity">Maximise colour similarity</option>
                        </select>
                        <button id="reoptimize-button" class="reoptimize-button">Re-optimize</button>
                    </div>
                    <div class="optimization-actions">
                        <form method="dialog">
                            <button id="cancel-optimization-button" class="cancel-optimization-button">Cancel</button>
                        </form>
                        <button id="apply-all-button" class="apply-all-button" autofocus>Apply All Changes</button>
                    </div>
                </div>
            </div>
        `;
        
        // Append the modal to the document body
        document.body.appendChild(modal);
        
        // Add event listeners for modal buttons
        document.querySelector('.close-modal-button').addEventListener('click', () => {
            modal.close();
        });
        
        document.getElementById('apply-all-button').addEventListener('click', applyAllOptimizations);
        document.getElementById('reoptimize-button').addEventListener('click', reoptimizeWithNewSettings);
        
        // Add modal styles
        addModalStyles();
    }
}

/**
 * Add CSS styles for the optimization modal
 */
function addModalStyles() {
    const style = document.createElement('style');
    style.textContent = `
        /* Modal dialog styles */
        .optimization-modal {
            max-width: 90%;
            width: 800px;
            max-height: 90vh;
            border: 1px solid #e0e0e0;
            border-radius: 5px;
            padding: 0;
            overflow: visible;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .optimization-modal::backdrop {
            background-color: rgba(0, 0, 0, 0.5);
        }
        
        .optimization-modal-content {
            display: flex;
            flex-direction: column;
            max-height: 90vh;
        }
        
        .optimization-modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1rem;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .optimization-modal-header h3 {
            margin: 0;
            font-size: 1.25rem;
        }
        
        .close-modal-button {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0.5rem;
            line-height: 0.5;
            border-radius: 4px;
        }
        
        .close-modal-button:hover,
        .close-modal-button:focus {
            background-color: #f0f0f0;
        }
        
        .optimization-modal-body {
            padding: 1rem;
            overflow-y: auto;
            flex: 1 1 auto;
        }
        
        .table-container {
            overflow-x: auto;
        }
        
        .optimization-summary {
            margin-bottom: 1rem;
            padding: 0.5rem;
            background-color: #f0f0f0;
            border-radius: 4px;
        }
        
        .optimization-results-table {
            width: 100%;
            border-collapse: collapse;
        }
        
        .optimization-results-table th,
        .optimization-results-table td {
            padding: 0.5rem;
            border: 1px solid #e0e0e0;
            text-align: left;
        }
        
        .optimization-results-table th {
            background-color: #f5f5f5;
        }
        
        .colour-preview {
            display: inline-block;
            width: 20px;
            height: 20px;
            margin-right: 0.5rem;
            border: 1px solid #ccc;
            vertical-align: middle;
            border-radius: 4px;
        }
        
        .contrast-pass {
            color: green;
            font-weight: bold;
        }
        
        .contrast-fail {
            color: red;
            font-weight: bold;
        }
        
        .apply-button {
            background-color: #2196F3;
            color: white;
            border: none;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .apply-button:hover {
            background-color: #0c7cd5;
        }
        
        .optimization-modal-footer {
            padding: 1rem;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .optimization-settings {
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
        
        .optimization-actions {
            display: flex;
            gap: 0.5rem;
        }
        
        .cancel-optimization-button {
            padding: 0.5rem 1rem;
            border: 1px solid #ccc;
            background-color: white;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .apply-all-button, .reoptimize-button {
            padding: 0.5rem 1rem;
            background-color: #2196F3;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
        }
        
        .apply-all-button:hover, .reoptimize-button:hover {
            background-color: #0c7cd5;
        }
        
        /* Focus styles for accessibility */
        .optimization-modal button:focus {
            outline: 2px solid #2196F3;
            outline-offset: 2px;
        }
        
        /* Screen reader only class */
        .sr-only {
            position: absolute;
            width: 1px;
            height: 1px;
            padding: 0;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
            border-width: 0;
        }
    `;
    document.head.appendChild(style);
}

/**
 * Optimize the palette for a specific section
 * This analyzes all colours and suggests optimized alternatives
 * @param {string} section - The ID of the section to optimize
 * @param {string} backgroundColor - The background colour to optimize against
 * @param {number} targetContrast - The target contrast ratio
 */
function optimizePalette(section, backgroundColor, targetContrast) {
    console.log(`Optimizing palette for section: ${section}, background: ${backgroundColor}, target: ${targetContrast}`);
    
    // Get the table for this section
    let table;
    if (section === 'custom') {
        table = document.getElementById('userColorTable');
    } else {
        // Find the table within the section
        const sectionElement = document.getElementById(section);
        if (sectionElement) {
            table = sectionElement.querySelector('table');
        }
    }
    
    if (!table) {
        console.error(`Table not found for section: ${section}`);
        return;
    }
    
    // Get all colour rows from the table
    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) {
        console.log(`No rows found in table: ${table.id || 'unnamed table'}`);
        return;
    }
    
    // Create an array to store colour data
    const colourData = [];
    
    // Process each row to get colour data
    rows.forEach((row, index) => {
        // Get the colour from the first cell
        const colorCell = row.querySelector('th');
        if (!colorCell) {
            console.error(`No color cell found in row ${index}`);
            return;
        }
        
        const color = colorCell.textContent.trim();
        
        // Calculate current contrast
        const contrast = calculateContrast(color, backgroundColor);
        
        // Generate optimized colour if needed
        let optimizedColor = color;
        let similarity = 100;
        
        if (contrast < targetContrast) {
            // Get optimization priority
            const priority = document.getElementById('optimization-priority')?.value || 'balanced';
            
            // Get an optimized colour
            const optimizationResult = generateOptimizedColor(color, backgroundColor, targetContrast, priority);
            optimizedColor = optimizationResult.color;
            similarity = optimizationResult.similarity;
        }
        
        // Calculate new contrast
        const newContrast = calculateContrast(optimizedColor, backgroundColor);
        
        // Add to colour data array
        colourData.push({
            originalColor: color,
            optimizedColor: optimizedColor,
            originalContrast: contrast,
            newContrast: newContrast,
            similarity: similarity,
            needsChange: contrast < targetContrast
        });
    });
    
    // Open the modal with the optimization results
    showOptimizationResults(section, colourData, backgroundColor, targetContrast);
}

/**
 * Generate an optimized colour that meets the target contrast
 * @param {string} originalColor - The original colour to optimize
 * @param {string} backgroundColor - The background colour to optimize against
 * @param {number} targetContrast - The target contrast ratio
 * @param {string} priority - Optimization priority: 'balanced', 'contrast', or 'similarity'
 * @returns {Object} - The optimized colour and similarity percentage
 */
function generateOptimizedColor(originalColor, backgroundColor, targetContrast, priority = 'balanced') {
    // We'll use a similar approach to the existing generateAlternatives function
    // but tailored for specific optimization priorities
    
    try {
        console.log(`Generating optimized color for ${originalColor} against ${backgroundColor} with target contrast ${targetContrast}`);
        console.log(`Optimization priority: ${priority}`);
        
        // Convert to LAB colour space for better manipulation
        const originalLab = chroma(originalColor).lab();
        const backgroundLuminance = chroma(backgroundColor).luminance();
        
        // Determine if we need to lighten or darken
        // If background is dark, lighten the colour; if light, darken it
        const direction = backgroundLuminance > 0.5 ? -1 : 1;
        
        // Different step sizes based on priority
        let stepSizes;
        let maxSteps;
        
        switch (priority) {
            case 'contrast':
                // Larger steps, prioritizing reaching contrast target quickly
                stepSizes = [10, 15, 20, 25, 30];
                maxSteps = 30;
                break;
            case 'similarity':
                // Smaller steps, prioritizing minimal colour change
                stepSizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
                maxSteps = 40;
                break;
            case 'balanced':
            default:
                // Medium steps, balancing contrast and similarity
                stepSizes = [3, 6, 9, 12, 15, 18, 21];
                maxSteps = 35;
                break;
        }
        
        // Try different adjustments until we find one that meets the target
        let bestColor = originalColor;
        let bestContrast = calculateContrast(originalColor, backgroundColor);
        let bestSimilarity = 100;
        
        // First try lightness adjustments
        for (let step = 1; step <= maxSteps; step++) {
            for (const stepSize of stepSizes) {
                const adjustment = step * stepSize * direction;
                let newLab = [...originalLab];
                newLab[0] = Math.max(0, Math.min(100, originalLab[0] + adjustment));
                
                try {
                    const newColor = chroma.lab(...newLab).hex();
                    const contrast = calculateContrast(newColor, backgroundColor);
                    const deltaE = chroma.deltaE(originalColor, newColor);
                    const similarity = Math.max(0, 100 - deltaE);
                    
                    // If this meets our target and is better than what we have
                    if (contrast >= targetContrast) {
                        // For similarity priority, take the first one that meets contrast
                        if (priority === 'similarity') {
                            return {
                                color: newColor,
                                contrast: contrast,
                                similarity: similarity
                            };
                        }
                        
                        // For balanced, find the best similarity that meets contrast
                        if (priority === 'balanced' && similarity > bestSimilarity) {
                            bestColor = newColor;
                            bestContrast = contrast;
                            bestSimilarity = similarity;
                        }
                        
                        // For contrast priority, find the highest contrast
                        if (priority === 'contrast' && contrast > bestContrast) {
                            bestColor = newColor;
                            bestContrast = contrast;
                            bestSimilarity = similarity;
                        }
                    }
                } catch (e) {
                    // Invalid colour, skip
                }
            }
        }
        
        // If we found a good colour that meets the target, return it
        if (bestContrast >= targetContrast) {
            return {
                color: bestColor,
                contrast: bestContrast,
                similarity: bestSimilarity
            };
        }
        
        // If we didn't find a good match with lightness adjustments,
        // try some more aggressive adjustments including saturation
        for (let step = 1; step <= 15; step++) {
            // Adjust lightness
            let newLab = [...originalLab];
            newLab[0] = Math.max(0, Math.min(100, originalLab[0] + step * 5 * direction));
            
            // Also adjust saturation (a and b components in Lab)
            // Increase or decrease based on what might help contrast
            const satAdjust = direction > 0 ? 1.2 : 0.8;
            newLab[1] *= satAdjust;
            newLab[2] *= satAdjust;
            
            try {
                const newColor = chroma.lab(...newLab).hex();
                const contrast = calculateContrast(newColor, backgroundColor);
                const deltaE = chroma.deltaE(originalColor, newColor);
                const similarity = Math.max(0, 100 - deltaE);
                
                if (contrast >= targetContrast && (
                    (priority === 'contrast' && contrast > bestContrast) ||
                    (priority === 'similarity' && similarity > bestSimilarity) ||
                    (priority === 'balanced' && (contrast * similarity > bestContrast * bestSimilarity))
                )) {
                    bestColor = newColor;
                    bestContrast = contrast;
                    bestSimilarity = similarity;
                }
            } catch (e) {
                // Invalid colour, skip
            }
        }
        
        // If we still don't have a good match, try hue adjustments
        if (bestContrast < targetContrast) {
            const originalHSL = chroma(originalColor).hsl();
            
            for (let hueShift = -60; hueShift <= 60; hueShift += 10) {
                if (hueShift === 0) continue;
                
                try {
                    const newHue = (originalHSL[0] + hueShift + 360) % 360;
                    
                    // Also adjust lightness in HSL
                    const lightAdj = direction > 0 ? 
                        Math.min(1, originalHSL[2] * 1.3) : 
                        Math.max(0, originalHSL[2] * 0.7);
                    
                    const newColor = chroma.hsl(newHue, originalHSL[1], lightAdj).hex();
                    const contrast = calculateContrast(newColor, backgroundColor);
                    const deltaE = chroma.deltaE(originalColor, newColor);
                    const similarity = Math.max(0, 100 - deltaE);
                    
                    if (contrast >= targetContrast && (
                        (priority === 'contrast' && contrast > bestContrast) ||
                        (priority === 'similarity' && similarity > bestSimilarity) ||
                        (priority === 'balanced' && (contrast * similarity > bestContrast * bestSimilarity))
                    )) {
                        bestColor = newColor;
                        bestContrast = contrast;
                        bestSimilarity = similarity;
                    }
                } catch (e) {
                    // Invalid colour, skip
                }
            }
        }
        
        // If we found any improvement, return it
        if (bestContrast > calculateContrast(originalColor, backgroundColor)) {
            return {
                color: bestColor,
                contrast: bestContrast,
                similarity: bestSimilarity
            };
        }
        
        // Fallback to a high contrast option if all else fails
        // This is a more radical change but ensures we meet the target
        const fallbackColor = backgroundLuminance > 0.5 ? '#000000' : '#FFFFFF';
        const fallbackContrast = calculateContrast(fallbackColor, backgroundColor);
        const fallbackDeltaE = chroma.deltaE(originalColor, fallbackColor);
        const fallbackSimilarity = Math.max(0, 100 - fallbackDeltaE);
        
        return {
            color: fallbackColor,
            contrast: fallbackContrast,
            similarity: fallbackSimilarity
        };
    } catch (e) {
        console.error('Error generating optimized color:', e);
        // Return a safe fallback
        return {
            color: originalColor,
            contrast: calculateContrast(originalColor, backgroundColor),
            similarity: 100
        };
    }
}

/**
 * Show the optimization results in the modal
 * @param {string} section - The ID of the section being optimized
 * @param {Array} colourData - Array of colour data objects
 * @param {string} backgroundColor - The background colour
 * @param {number} targetContrast - The target contrast ratio
 */
function showOptimizationResults(section, colourData, backgroundColor, targetContrast) {
    // Store the current optimization context for later use
    window.currentOptimization = {
        section: section,
        colourData: colourData,
        backgroundColor: backgroundColor,
        targetContrast: targetContrast
    };
    
    // Get the modal element
    const modal = document.getElementById('optimization-modal');
    const summaryElement = document.getElementById('optimization-summary');
    const resultsBody = document.getElementById('optimization-results-body');
    
    // Clear previous results
    resultsBody.innerHTML = '';
    
    // Calculate optimization statistics
    const totalColors = colourData.length;
    const initialFailures = colourData.filter(data => data.originalContrast < targetContrast).length;
    const successfulOptimizations = colourData.filter(data => data.needsChange && data.newContrast >= targetContrast).length;
    const averageSimilarity = colourData.filter(data => data.needsChange).reduce((sum, data) => sum + data.similarity, 0) / 
                              (initialFailures || 1); // Avoid division by zero
    
    // Create the summary
    summaryElement.innerHTML = `
        <p>Optimizing ${totalColors} colours against background ${backgroundColor} with target contrast ${targetContrast}:1</p>
        <ul>
            <li>${initialFailures} colours initially failed to meet contrast requirements</li>
            <li>${successfulOptimizations} colours were successfully optimized</li>
            <li>Average similarity of optimized colours: ${averageSimilarity.toFixed(1)}%</li>
        </ul>
    `;
    
    // Create a row for each colour
    colourData.forEach((data, index) => {
        const row = document.createElement('tr');
        
        // Original colour cell
        const originalCell = document.createElement('td');
        originalCell.innerHTML = `
            <span class="colour-preview" style="background-color: ${data.originalColor}"></span>
            <span class="colour-code">${data.originalColor}</span>
        `;
        row.appendChild(originalCell);
        
        // Optimized colour cell
        const optimizedCell = document.createElement('td');
        optimizedCell.innerHTML = `
            <span class="colour-preview" style="background-color: ${data.optimizedColor}"></span>
            <span class="colour-code">${data.optimizedColor}</span>
        `;
        row.appendChild(optimizedCell);
        
        // Original contrast cell
        const originalContrastCell = document.createElement('td');
        const originalContrastClass = data.originalContrast >= targetContrast ? 'contrast-pass' : 'contrast-fail';
        originalContrastCell.innerHTML = `
            <span class="${originalContrastClass}">${data.originalContrast.toFixed(2)}:1</span>
        `;
        row.appendChild(originalContrastCell);
        
        // New contrast cell
        const newContrastCell = document.createElement('td');
        const newContrastClass = data.newContrast >= targetContrast ? 'contrast-pass' : 'contrast-fail';
        newContrastCell.innerHTML = `
            <span class="${newContrastClass}">${data.newContrast.toFixed(2)}:1</span>
        `;
        row.appendChild(newContrastCell);
        
        // Similarity cell
        const similarityCell = document.createElement('td');
        similarityCell.textContent = `${data.similarity.toFixed(1)}%`;
        row.appendChild(similarityCell);
        
        // Actions cell
        const actionsCell = document.createElement('td');
        if (data.needsChange) {
            const applyButton = document.createElement('button');
            applyButton.className = 'apply-button';
            applyButton.textContent = 'Apply';
            applyButton.setAttribute('aria-label', `Apply optimized colour ${data.optimizedColor}`);
            applyButton.dataset.index = index;
            applyButton.addEventListener('click', function() {
                applySingleOptimization(this.dataset.index);
            });
            actionsCell.appendChild(applyButton);
        } else {
            actionsCell.textContent = 'No change needed';
        }
        row.appendChild(actionsCell);
        
        // Add the row to the table
        resultsBody.appendChild(row);
    });
    
    // Show the modal
    modal.showModal();
    
    // Set focus to the "Apply All Changes" button for accessibility
    const applyAllButton = document.getElementById('apply-all-button');
    if (applyAllButton) {
        // Small delay to ensure the modal is visible before focusing
        setTimeout(() => {
            applyAllButton.focus();
        }, 50);
    }
}

/**
 * Handle keydown events for the modal
 * @param {Event} event - The keydown event
 */
function handleModalKeydown(event) {
    const modal = document.getElementById('optimization-modal');
    
    // Only handle events when the modal is visible
    if (modal.style.display !== 'flex') {
        return;
    }
    
    // Close on Escape key
    if (event.key === 'Escape') {
        closeOptimizationModal();
        event.preventDefault();
    }
    
    // Trap focus within the modal (Tab key navigation)
    if (event.key === 'Tab') {
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (event.shiftKey && document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
        } else if (!event.shiftKey && document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
        }
    }
}

/**
 * Apply all optimizations at once
 */
function applyAllOptimizations() {
    if (!window.currentOptimization) {
        console.error('No active optimization');
        return;
    }
    
    const { colourData } = window.currentOptimization;
    
    // Apply each optimization that needs a change
    colourData.forEach((data, index) => {
        if (data.needsChange && data.originalColor !== data.optimizedColor) {
            // Replace the colour in the palette
            replaceColor(data.originalColor, data.optimizedColor);
            
            // Update the data in the colourData array
            colourData[index].originalColor = data.optimizedColor;
            colourData[index].originalContrast = data.newContrast;
            colourData[index].needsChange = false;
        }
    });
    
    // Close the modal
    const modal = document.getElementById('optimization-modal');
    modal.close();
}

/**
 * Re-optimize the palette with new settings
 */
function reoptimizeWithNewSettings() {
    if (!window.currentOptimization) {
        console.error('No active optimization');
        return;
    }
    
    const { section, backgroundColor, targetContrast } = window.currentOptimization;
    
    // Close the current modal
    const modal = document.getElementById('optimization-modal');
    modal.close();
    
    // Re-run the optimization with the current settings
    optimizePalette(section, backgroundColor, targetContrast);
}

/**
 * Update the optimization summary after changes
 */
function updateOptimizationSummary() {
    if (!window.currentOptimization) {
        return;
    }
    
    const { colourData, targetContrast } = window.currentOptimization;
    const summaryElement = document.getElementById('optimization-summary');
    
    // Calculate updated statistics
    const totalColors = colourData.length;
    const remainingFailures = colourData.filter(data => data.originalContrast < targetContrast).length;
    const appliedChanges = colourData.filter(data => !data.needsChange && data.originalColor === data.optimizedColor).length;
    
    // Update the summary
    summaryElement.innerHTML = `
        <p>Optimization progress:</p>
        <ul>
            <li>${remainingFailures} colours still fail to meet contrast requirements</li>
            <li>${appliedChanges} optimizations have been applied</li>
            <li>${totalColors - remainingFailures} colours now meet contrast requirements</li>
        </ul>
    `;
}

// Add to the existing window.onload or document.ready function
document.addEventListener('DOMContentLoaded', function() {
    // Initialize the palette optimizer
    initPaletteOptimizer();
});
