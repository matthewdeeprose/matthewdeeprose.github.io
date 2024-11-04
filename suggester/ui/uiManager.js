/**
 * @fileoverview UI Manager for Color Contrast Tool 30/11/24 15:29
 * 
 * This class manages the user interface updates and accessibility features for
 * the color contrast checking tool. It ensures:
 * - Visual updates are synchronized with ARIA and screen reader text
 * - Contrast ratios are clearly displayed
 * - WCAG compliance levels are properly communicated
 * - Error messages are accessible
 * 
 * WCAG Compliance:
 * - 1.4.3 Contrast (Minimum) - Level AA
 * - 1.4.11 Non-text Contrast - Level AA
 * - 4.1.3 Status Messages - Level AA
 */

export class UIManager {
	/**
	 * Creates a new UIManager instance
	 * @param {Object} elements - Map of DOM elements used by the UI
	 * @param {ColorStorage} colorStorage - Reference to the color storage system
	 */
	constructor(elements, colorStorage) {
		console.log("UIManager initialized with elements:", elements);
		if (!elements) {
			throw new Error('Elements map is required for UIManager');
		}
		if (!colorStorage) {
			throw new Error('ColorStorage reference is required for UIManager');
		}

		this.elements = elements;
		this.colorStorage = colorStorage;



		// Set up ARIA live regions for dynamic updates
		if (this.elements.srResults) {
			this.elements.srResults.setAttribute('aria-live', 'polite');
			this.elements.srResults.setAttribute('role', 'status');
		}

		// Initialize hold buttons (after ARIA setup)
		this.initializeHoldButtons();
	}

	/**
	 * Updates all UI elements with new color combinations
	 * Handles visual updates and accessibility information
	 * @param {string} backgroundColor - Hex code for background color
	 * @param {string} textColor - Hex code for text color
	 * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
	 */
	updateUI(backgroundColor, textColor, graphicColors) {
		console.log("Updating UI with colors:", {
			backgroundColor,
			textColor,
			graphicColors
		});
		const {
			elements
		} = this;

		// Update background color information
		this.updateBackgroundColor(backgroundColor);

		// Update text color information and contrast
		this.updateTextColor(backgroundColor, textColor);

		// Update graphics colors and their contrast
		this.updateGraphicColors(backgroundColor, graphicColors);

		// Update screen reader announcement
		this.updateScreenReaderText(backgroundColor, textColor, graphicColors);

		// Add this line:
		this.updateHoldButtonIcons();
	}

	/**
	 * Updates the randomize counter display
	 * @param {number} count - Current count of randomizations
	 */
	updateRandomizeCounter(count) {
		if (this.elements.counterDisplay) {
			this.elements.counterDisplay.textContent = `Randomized ${count} ${count === 1 ? 'time' : 'times'}`;
			// Update for screen readers
			if (this.elements.srResults) {
				this.elements.srResults.textContent += ` Randomize button clicked ${count} ${count === 1 ? 'time' : 'times'}.`;
			}
		}
	}

	/**
	 * Updates background color-related elements
	 * @param {string} backgroundColor - Hex code for background color
	 */
	updateBackgroundColor(backgroundColor) {
		const {
			elements
		} = this;
		elements.backgroundColor.textContent = backgroundColor;
		elements.infoGraphicBox.style.backgroundColor = backgroundColor;
		elements.bgColor.style.backgroundColor = backgroundColor;
		elements.backgroundName.textContent = `(${this.getColorName(backgroundColor)})`;
	}

	/**
	 * Updates text color-related elements and contrast information
	 * @param {string} backgroundColor - Hex code for background color
	 * @param {string} textColor - Hex code for text color
	 */
	updateTextColor(backgroundColor, textColor) {
		const {
			elements
		} = this;
		const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);

		// Update text color display
		elements.tcolor.textContent = textColor;
		elements.tColorName.textContent = `(${this.getColorName(textColor)})`;
		elements.tColorColor.style.backgroundColor = textColor;

		// Update contrast information
		elements.tcontrast.textContent = `${textContrastRatio}:1`;
		elements.tcontrastWCAG.textContent = this.getWcagRating(textContrastRatio);

		// Apply text color to sample text
		elements.infoTexT.style.color = textColor;
	}

	/**
	 * Updates graphic color elements and their contrast information
	 * @param {string} backgroundColor - Hex code for background color
	 * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
	 */
	updateGraphicColors(backgroundColor, graphicColors) {
		graphicColors.forEach((color, index) => {
			const num = index + 1;
			const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);

			// Update color samples
			this.elements[`icon${num}`].style.color = color;
			this.elements[`g${num}colourSpan2`].style.backgroundColor = color;

			// Update color information
			this.elements[`g${num}colourSpan1`].textContent = color;
			this.elements[`g${num}contrast`].textContent = `${contrastRatio}:1`;
			this.elements[`g${num}contrastWCAG`].textContent = this.getWcagRating(contrastRatio);
			this.elements[`gfx${num}ColorName`].textContent = `(${this.getColorName(color)})`;
		});
	}



	/**
	 * Create and update the color management UI with improved accessibility
	 * @param {Array} colors - Array of color objects
	 * @param {Set} activeColors - Set of currently active color hexes
	 * @param {Function} onColorToggle - Callback for when a color is toggled
	 * @param {Function} onToggleAll - Callback for when select all/none is toggled
	 */
	updateColorManagementUI(colors, activeColors, onColorToggle, onToggleAll) {
		const container = document.getElementById('colorManagement');
		if (!container) {
			console.warn('Colour management container not found');
			return;
		}

		// Clear existing content
		container.innerHTML = '';

		// Add descriptive heading
		const heading = document.createElement('h2');
		heading.textContent = 'Color Selection';
		heading.className = 'color-management-heading';
		container.appendChild(heading);

		// Create fieldset for better grouping
		const fieldset = document.createElement('fieldset');
		const legend = document.createElement('legend');
		legend.textContent = 'Available Colors';
		fieldset.appendChild(legend);

		// Create select all checkbox with enhanced accessibility
		const selectAllDiv = document.createElement('div');
		selectAllDiv.className = 'select-all-container';

		const selectAllCheckbox = document.createElement('input');
		selectAllCheckbox.type = 'checkbox';
		selectAllCheckbox.id = 'selectAllColors';
		selectAllCheckbox.checked = colors.length === activeColors.size;
		selectAllCheckbox.setAttribute('aria-controls', 'colorList');

		const selectAllLabel = document.createElement('label');
		selectAllLabel.htmlFor = 'selectAllColors';
		selectAllLabel.textContent = 'Select all colors';

		// Create color list using ul/li for semantic structure
		const colorList = document.createElement('ul');
		colorList.id = 'colorList';
		colorList.className = 'color-list';
		colorList.setAttribute('aria-label', 'Colour options');

		// Function to update select all checkbox state
		const updateSelectAllState = () => {
			const allCheckboxes = colorList.querySelectorAll('input[type="checkbox"]');
			const allChecked = Array.from(allCheckboxes).every(cb => cb.checked);
			selectAllCheckbox.checked = allChecked;
		};

		// Add keyboard handling for better accessibility and select all functionality
		selectAllCheckbox.addEventListener('change', (e) => {
			const isChecked = e.target.checked;
			const colorCheckboxes = colorList.querySelectorAll('input[type="checkbox"]');
			colorCheckboxes.forEach(checkbox => {
				if (checkbox.checked !== isChecked) {
					checkbox.checked = isChecked;
					onColorToggle(checkbox.id.replace('color-', ''));
				}
			});
			onToggleAll(isChecked);
			this.announceSelectionChange(isChecked ? 'all' : 'none');
		});

		colors.forEach(color => {
			const colorItem = document.createElement('li');
			colorItem.className = 'color-item';

			const checkbox = document.createElement('input');
			checkbox.type = 'checkbox';
			checkbox.id = `color-${color.colourHex}`;
			checkbox.checked = activeColors.has(color.colourHex);
			checkbox.setAttribute('aria-describedby', `desc-${color.colourHex}`);

			// Add keyboard handling for the checkbox and update select all state
			checkbox.addEventListener('change', (e) => {
				onColorToggle(color.colourHex);
				this.announceColorSelection(color.name, e.target.checked);
				updateSelectAllState();
			});

			const colorSwatch = document.createElement('span');
			colorSwatch.className = 'color-swatch Trichromacy'; // Added Trichromacy class
			colorSwatch.style.backgroundColor = color.colourHex;
			colorSwatch.setAttribute('role', 'presentation');

			const label = document.createElement('label');
			label.htmlFor = `color-${color.colourHex}`;
			label.textContent = color.name;

			// Add hidden description for screen readers
			const description = document.createElement('span');
			description.id = `desc-${color.colourHex}`;
			description.className = 'sr-only';
			description.textContent = `Color: ${color.name}, Hex value: ${color.colourHex}`;

			colorItem.appendChild(checkbox);
			colorItem.appendChild(colorSwatch);
			colorItem.appendChild(label);
			colorItem.appendChild(description);
			colorList.appendChild(colorItem);
		});

		selectAllDiv.appendChild(selectAllCheckbox);
		selectAllDiv.appendChild(selectAllLabel);
		fieldset.appendChild(selectAllDiv);
		fieldset.appendChild(colorList);
		container.appendChild(fieldset);

		// Add live region for announcing changes
		const liveRegion = document.createElement('div');
		liveRegion.id = 'colorSelectionAnnouncement';
		liveRegion.className = 'sr-only';
		liveRegion.setAttribute('role', 'status');
		liveRegion.setAttribute('aria-live', 'polite');
		container.appendChild(liveRegion);

		// Initialize select all state
		updateSelectAllState();
	}
	/**
	 * Displays upload statistics and both valid and invalid background colors
	 * @param {Object} stats - Statistics about color combinations
	 */
	displayUploadStats(stats) {
		console.log("Displaying upload stats:", stats);
		const statsContainer = document.getElementById('uploadStats');
		if (!statsContainer) {
			console.warn('Stats container not found');
			return;
		}

		// Create the statistics section
		const statsHtml = `
        <h3>Colour Set Statistics</h3>
        <ul role="list">
            <li>Total colours loaded: ${stats.totalColors}</li>
            <li>Valid background colours: ${stats.validBackgrounds}</li>
            <li>Invalid background colours: ${stats.totalColors - stats.validBackgrounds}</li>
            <li>Possible combinations: ${stats.totalCombinations.toLocaleString()}</li>
        </ul>
    `;

		let backgroundsSection = '';
		if (this.colorStorage && stats.totalColors > 0) {
			try {
				const validBackgrounds = this.colorStorage.getValidBackgroundsWithNames();
				const invalidBackgrounds = this.colorStorage.getInvalidBackgroundsWithNames();

				backgroundsSection = `
                <div class="backgrounds-section">
                    <!-- Valid Backgrounds Section -->
                    <div class="valid-backgrounds-section">
                        <button class="toggle-backgrounds" aria-expanded="false" aria-controls="validBackgroundsList">
                            Show valid background colours (${validBackgrounds.length})
                        </button>
                        <div id="validBackgroundsList" class="backgrounds-list" hidden>
                            <h4>Valid Background Colours</h4>
                            <ul class="color-swatches" role="list">
                                ${validBackgrounds.map(color => `
                                    <li class="color-swatch-item">
                                        <span class="color-swatch Trichromacy" 
                                              style="background-color: ${color.hex};"
                                              role="presentation"></span>
                                        <span class="color-info">
                                            <span class="color-name">${color.name}</span>
                                            <span class="color-value">${color.hex}</span>
                                        </span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>

                    <!-- Invalid Backgrounds Section -->
                    <div class="invalid-backgrounds-section">
                        <button class="toggle-backgrounds" aria-expanded="false" aria-controls="invalidBackgroundsList">
                            Show background colours we cannot use (${invalidBackgrounds.length})
                        </button>
                        <div id="invalidBackgroundsList" class="backgrounds-list" hidden>
                            <h4>Invalid Background Colours</h4>
                            <ul class="color-swatches" role="list">
                                ${invalidBackgrounds.map(color => `
                                    <li class="color-swatch-item">
                                        <span class="color-swatch Trichromacy" 
                                              style="background-color: ${color.hex};"
                                              role="presentation"></span>
                                        <span class="color-info">
                                            <span class="color-name">${color.name}</span>
                                            <span class="color-value">${color.hex}</span>
                                            <span class="color-reason" role="note">${color.reason}</span>
                                        </span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
			} catch (error) {
				console.error('Error generating backgrounds display:', error);
				backgroundsSection = '';
			}
		}

		// Combine both sections
		statsContainer.innerHTML = statsHtml + backgroundsSection;

		// Add toggle functionality for both sections
		const toggleButtons = statsContainer.querySelectorAll('.toggle-backgrounds');
		toggleButtons.forEach(button => {
			const targetId = button.getAttribute('aria-controls');
			const targetList = document.getElementById(targetId);

			if (button && targetList) {
				button.addEventListener('click', () => {
					const isExpanded = button.getAttribute('aria-expanded') === 'true';
					button.setAttribute('aria-expanded', !isExpanded);
					button.textContent = button.textContent.replace(
						isExpanded ? 'Hide' : 'Show',
						isExpanded ? 'Show' : 'Hide'
					);
					targetList.hidden = isExpanded;
				});
			}
		});

		// Announce stats update to screen readers
		if (this.elements.srResults) {
			this.elements.srResults.textContent =
				`Statistics updated: ${stats.totalColors} colors loaded, ` +
				`${stats.validBackgrounds} valid backgrounds, ` +
				`${stats.totalColors - stats.validBackgrounds} invalid backgrounds, ` +
				`${stats.totalCombinations.toLocaleString()} possible combinations.`;
		}
	}
	/**
	 * Displays error messages accessibly
	 * @param {string} message - Error message to display
	 */
	displayError(message) {
		console.error("Displaying error:", message);
		displayNotification(message, 'error');
	}

	/**
	 * Clears error messages
	 */
	clearError() {
		const messageDiv = document.getElementById('myMessage');
		if (messageDiv) {
			messageDiv.style.display = 'none';
			document.getElementById('pageMessage').textContent = '';
		}
	}
	/**
	 * Updates screen reader announcement text with current color information
	 * @param {string} backgroundColor - Hex code for background color
	 * @param {string} textColor - Hex code for text color
	 * @param {Array<string>} graphicColors - Array of hex codes for graphic colors
	 */
	updateScreenReaderText(backgroundColor, textColor, graphicColors) {
		console.log("Updating screen reader text");
		if (!this.elements.srResults) {
			console.warn('Screen reader results element not found');
			return;
		}

		const textContrastRatio = chroma.contrast(textColor, backgroundColor).toFixed(2);
		const textWCAG = this.getWcagRating(textContrastRatio);

		// Build accessible announcement text
		let srText = `New color combination selected. `;
		srText += `Background color is ${this.getColorName(backgroundColor)} (${backgroundColor}). `;
		srText += `Text color is ${this.getColorName(textColor)} (${textColor}) `;
		srText += `with contrast ratio ${textContrastRatio}:1, WCAG level ${textWCAG}. `;

		graphicColors.forEach((color, index) => {
			const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
			const wcagRating = this.getWcagRating(contrastRatio);
			srText += `Graphic element ${index + 1} uses ${this.getColorName(color)} (${color}) `;
			srText += `with contrast ratio ${contrastRatio}:1, WCAG level ${wcagRating}. `;
		});

		this.elements.srResults.textContent = srText.trim();
	}

	/**
	 * Determine WCAG compliance level based on contrast ratio
	 * @param {number} contrastRatio - The calculated contrast ratio
	 * @returns {string} WCAG compliance level (AAA, AA, G, or F)
	 */
	getWcagRating(contrastRatio) {
		if (contrastRatio >= 7) return "AAA"; // Highest contrast - Enhanced
		if (contrastRatio >= 4.5) return "AA"; // Standard level for text
		if (contrastRatio >= 3) return "G"; // Minimum for graphics
		return "F"; // Fails contrast requirements
	}

	/**
	 * Gets the human-readable name for a color
	 * @param {string} colour - Hex code of the color
	 * @returns {string} Human-readable color name
	 */
	getColorName(colour) {
		return this.colorStorage.getColorName(colour);
	}

	/**
	 * Announce color selection changes to screen readers
	 * @param {string} colorName - Name of the color
	 * @param {boolean} isSelected - Whether the color was selected or unselected
	 */
	announceColorSelection(colorName, isSelected) {
		const liveRegion = document.getElementById('colorSelectionAnnouncement');
		if (liveRegion) {
			liveRegion.textContent = `${colorName} ${isSelected ? 'selected' : 'unselected'}`;
		}
	}

	/**
	 * Announce bulk selection changes to screen readers
	 * @param {string} selectionType - Type of selection ('all' or 'none')
	 */
	announceSelectionChange(selectionType) {
		const liveRegion = document.getElementById('colorSelectionAnnouncement');
		if (liveRegion) {
			liveRegion.textContent = `${selectionType === 'all' ? 'All colors selected' : 'All colors unselected'}`;
		}
	}

	/**
	 * Initializes hold buttons with SVG icons
	 */
	initializeHoldButtons() {
		console.log("Initializing hold buttons");

		// Find all hold buttons
		const holdButtons = document.querySelectorAll('.hold-button');

		holdButtons.forEach(button => {
			button.addEventListener('click', (e) => {
				const colorType = button.dataset.colorType;
				const targetId = button.dataset.colorTarget;
				const colorElement = document.getElementById(targetId);
				const computedStyle = window.getComputedStyle(colorElement);
				const backgroundColor = computedStyle.backgroundColor;

				// Convert RGB to hex
				const hexColor = this.rgbToHex(backgroundColor);

				// Toggle hold state in storage
				const isNowHeld = this.colorStorage.toggleHoldColor(colorType, hexColor);

				// Update all button icons
				this.updateHoldButtonIcons();

				// Announce change to screen readers
				this.announceHoldStateChange(colorType, isNowHeld);
			});
		});

		// Initialize initial icon states
		this.updateHoldButtonIcons();
	}
	/**
	 * Updates the hold button icons based on their pressed state
	 * Uses SVG icons for consistent cross-platform display
	 */
	updateHoldButtonIcons() {
		const holdButtons = document.querySelectorAll('.hold-button');

		holdButtons.forEach(button => {
			const colorType = button.dataset.colorType;
			const isHeld = this.colorStorage.isColorHeld(colorType);

			// Update aria-pressed state
			button.setAttribute('aria-pressed', isHeld);

			// Clear existing icon content
			button.innerHTML = '';

			// Create new SVG use element
			const iconUse = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			iconUse.setAttribute('width', '20');
			iconUse.setAttribute('height', '20');
			iconUse.setAttribute('aria-hidden', 'true');
			iconUse.setAttribute('focusable', 'false');

			const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
			use.setAttributeNS(
				'http://www.w3.org/1999/xlink',
				'href',
				isHeld ? '#icon-lock' : '#icon-unlock'
			);

			iconUse.appendChild(use);

			// Add visually hidden text for screen readers
			const srText = document.createElement('span');
			srText.className = 'visually-hidden';
			srText.textContent = `${isHeld ? 'Unlock' : 'Lock'} ${colorType} color`;

			button.appendChild(iconUse);
			button.appendChild(srText);
		});
	}
	// Helper method to convert RGB to Hex
	rgbToHex(rgb) {
		// Remove spaces and 'rgb(' and ')'
		const values = rgb.match(/\d+/g);
		if (!values || values.length !== 3) return null;

		const r = parseInt(values[0]);
		const g = parseInt(values[1]);
		const b = parseInt(values[2]);

		return '#' + [r, g, b].map(x => {
			const hex = x.toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		}).join('').toUpperCase();
	}

	announceHoldStateChange(colorType, isHeld) {
		const srResults = document.getElementById('srResults');
		if (srResults) {
			const colorName = this.colorStorage.getColorName(this.colorStorage.getHeldColor(colorType));
			const action = isHeld ? 'held' : 'released';
			srResults.textContent = `${colorType} color ${colorName} ${action}`;
		}
	}


}