/**
 * @fileoverview UI Manager for Color Contrast Tool 5/11/24 19:01
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
      throw new Error("Elements map is required for UIManager");
    }
    if (!colorStorage) {
      throw new Error("ColorStorage reference is required for UIManager");
    }

    this.elements = elements;
    this.colorStorage = colorStorage;

    // Set up ARIA live regions for dynamic updates
    if (this.elements.srResults) {
      this.elements.srResults.setAttribute("aria-live", "polite");
      this.elements.srResults.setAttribute("role", "status");
    }

    // Initialize hold buttons (after ARIA setup)
    this.initializeHoldButtons();
  }

  /**
   * Updates the randomize counter display
   * @param {number} count - Current count of randomizations
   */
  updateRandomizeCounter(count) {
    if (this.elements.counterDisplay) {
      this.elements.counterDisplay.textContent = `Randomized ${count} ${
        count === 1 ? "time" : "times"
      }`;
      // Update for screen readers
      if (this.elements.srResults) {
        this.elements.srResults.textContent += ` Randomize button clicked ${count} ${
          count === 1 ? "time" : "times"
        }.`;
      }
    }
  } // End of UIManager class

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
      graphicColors,
    });
    const { elements } = this;

    // Update background color information
    this.updateBackgroundColor(backgroundColor);

    // Update text color information and contrast
    this.updateTextColor(backgroundColor, textColor);

    // Update graphics colors and their contrast
    this.updateGraphicColors(backgroundColor, graphicColors);

    // Update screen reader announcement
    this.updateScreenReaderText(backgroundColor, textColor, graphicColors);

    // Update hold button icons
    this.updateHoldButtonIcons();
  }

  /**
   * Updates background color-related elements
   * @param {string} backgroundColor - Hex code for background color
   */
  updateBackgroundColor(backgroundColor) {
    const { elements } = this;
    elements.backgroundColor.textContent = backgroundColor;
    elements.infoGraphicBox.style.backgroundColor = backgroundColor;
    elements.bgColor.style.backgroundColor = backgroundColor;
    elements.backgroundName.textContent = `(${this.getColorName(
      backgroundColor
    )})`;
  }

  /**
   * Updates text color-related elements and contrast information
   * @param {string} backgroundColor - Hex code for background color
   * @param {string} textColor - Hex code for text color
   */
  updateTextColor(backgroundColor, textColor) {
    const { elements } = this;
    const textContrastRatio = chroma
      .contrast(textColor, backgroundColor)
      .toFixed(2);

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
      this.elements[`g${num}contrastWCAG`].textContent =
        this.getWcagRating(contrastRatio);
      this.elements[`gfx${num}ColorName`].textContent = `(${this.getColorName(
        color
      )})`;
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
    const container = document.getElementById("colorManagement");
    if (!container) {
      console.warn("Colour management container not found");
      return;
    }

    // Clear existing content
    container.innerHTML = "";

    // Add descriptive heading
    const heading = document.createElement("h2");
    heading.textContent = "Colour Selection";
    heading.className = "color-management-heading";
    container.appendChild(heading);

    // Create fieldset for better grouping
    const fieldset = document.createElement("fieldset");
    const legend = document.createElement("legend");
    legend.textContent = "Available Colours";
    fieldset.appendChild(legend);

    // Create select all checkbox with enhanced accessibility
    const selectAllDiv = document.createElement("div");
    selectAllDiv.className = "select-all-container";

    const selectAllCheckbox = document.createElement("input");
    selectAllCheckbox.type = "checkbox";
    selectAllCheckbox.id = "selectAllColors";
    selectAllCheckbox.checked = colors.length === activeColors.size;
    selectAllCheckbox.setAttribute("aria-controls", "colorList");

    const selectAllLabel = document.createElement("label");
    selectAllLabel.htmlFor = "selectAllColors";
    selectAllLabel.textContent = "Select all colours";

    // Create color list using ul/li for semantic structure
    const colorList = document.createElement("ul");
    colorList.id = "colorList";
    colorList.className = "color-list";
    colorList.setAttribute("aria-label", "Colour options");

    // Function to update select all checkbox state
    const updateSelectAllState = () => {
      const allCheckboxes = colorList.querySelectorAll(
        'input[type="checkbox"]'
      );
      const allChecked = Array.from(allCheckboxes).every((cb) => cb.checked);
      selectAllCheckbox.checked = allChecked;
    };

    // Add keyboard handling for better accessibility and select all functionality
    selectAllCheckbox.addEventListener("change", (e) => {
      const isChecked = e.target.checked;
      const colorCheckboxes = colorList.querySelectorAll(
        'input[type="checkbox"]'
      );
      colorCheckboxes.forEach((checkbox) => {
        if (checkbox.checked !== isChecked) {
          checkbox.checked = isChecked;
          onColorToggle(checkbox.id.replace("color-", ""));
        }
      });
      onToggleAll(isChecked);
      this.announceSelectionChange(isChecked ? "all" : "none");
    });

    colors.forEach((color) => {
      const colorItem = document.createElement("li");
      colorItem.className = "color-item";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = `color-${color.colourHex}`;
      checkbox.checked = activeColors.has(color.colourHex);
      checkbox.setAttribute("aria-describedby", `desc-${color.colourHex}`);

      // Add keyboard handling for the checkbox and update select all state
      checkbox.addEventListener("change", (e) => {
        onColorToggle(color.colourHex);
        this.announceColorSelection(color.name, e.target.checked);
        updateSelectAllState();
      });

      const colorSwatch = document.createElement("span");
      colorSwatch.className = "color-swatch Trichromacy"; // Added Trichromacy class
      colorSwatch.style.backgroundColor = color.colourHex;
      colorSwatch.setAttribute("role", "presentation");

      const label = document.createElement("label");
      label.htmlFor = `color-${color.colourHex}`;
      label.textContent = color.name;

      // Add hidden description for screen readers
      const description = document.createElement("span");
      description.id = `desc-${color.colourHex}`;
      description.className = "sr-only";
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
    const liveRegion = document.createElement("div");
    liveRegion.id = "colorSelectionAnnouncement";
    liveRegion.className = "sr-only";
    liveRegion.setAttribute("role", "status");
    liveRegion.setAttribute("aria-live", "polite");
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
    const statsContainer = document.getElementById("uploadStats");
    if (!statsContainer) {
      console.warn("Stats container not found");
      return;
    }

    // Create the statistics section
    const statsHtml = `
            <ul role="list">
            <li>Total colours loaded: ${stats.totalColors}</li>
            <li>Valid background colours: ${stats.validBackgrounds}</li>
            <li>Background colours we cannot use: ${
              stats.totalColors - stats.validBackgrounds
            }</li>
            <li>Possible combinations: ${stats.totalCombinations.toLocaleString()}</li>
        </ul>
    `;

    let backgroundsSection = "";
    if (this.colorStorage && stats.totalColors > 0) {
      try {
        const validBackgrounds =
          this.colorStorage.getValidBackgroundsWithNames();
        const invalidBackgrounds =
          this.colorStorage.getInvalidBackgroundsWithNames();

        // Get versatility data for each valid background
        const versatilityData = validBackgrounds
          .map((color) => {
            const colorSet = this.colorStorage.validColorSets.get(color.hex);
            const rawScore = this.calculateVersatilityScore(colorSet);
            // Round to 4 decimal places for comparison
            const versatilityScore = Number(rawScore.toFixed(4));

            // Debug logging
            console.group(
              `Versatility calculation for ${color.name} (${color.hex})`
            );
            console.log("Raw versatility score:", rawScore);
            console.log("Rounded versatility score:", versatilityScore);
            console.log(
              "Score as percentage:",
              Math.round(versatilityScore * 100)
            );
            console.log("Is highly versatile?", versatilityScore >= 0.35);
            console.log(
              "Comparison result:",
              `${versatilityScore} >= 0.35 = ${versatilityScore >= 0.35}`
            );
            console.groupEnd();

            return {
              ...color,
              colorSet,
              textOptions: colorSet.textColors.length,
              graphicOptions: colorSet.graphicColors.length,
              versatilityScore,
              isHighlyVersatile: versatilityScore >= 0.345,
            };
          })
          .sort((a, b) => b.versatilityScore - a.versatilityScore);

        backgroundsSection = `
                <div class="backgrounds-section">
                    <div class="valid-backgrounds-section">
                        <button class="toggle-backgrounds" aria-expanded="false" aria-controls="validBackgroundsList">
                            Show valid background colours (${
                              validBackgrounds.length
                            })
                        </button>
                        <div id="validBackgroundsList" class="backgrounds-list" hidden>
                            <h4>Valid Background Colours</h4>
                            <ul class="color-swatches" role="list">
                                ${versatilityData
                                  .map(
                                    (data) => `
                                    <li class="color-swatch-item ${
                                      data.isHighlyVersatile
                                        ? "highly-versatile"
                                        : ""
                                    }">
                                        <span class="color-swatch Trichromacy" 
                                              style="background-color: ${
                                                data.hex
                                              };"
                                              role="presentation"></span>
<span class="color-info">
    <span class="color-name">${data.name}</span>
    <span class="color-value">${data.hex}</span>
    <div class="versatility-info">
        <span class="versatility-score">Versatility: ${Math.round(
          data.versatilityScore * 100
        )}%</span>
        ${
          data.isHighlyVersatile
            ? '<span class="versatility-badge" role="img" aria-label="Highly versatile color">⭐</span>'
            : ""
        }
    </div>
<div class="color-versatility">
    <span class="text-options">
        <span class="contrast-breakdown">
${(() => {
  const aaaCount = data.colorSet.textColors.filter(
    (color) => chroma.contrast(data.hex, color.colourHex) >= 7
  ).length;
  const aaCount = data.colorSet.textColors.filter((color) => {
    const contrast = chroma.contrast(data.hex, color.colourHex);
    return contrast >= 4.5 && contrast < 7;
  }).length;

  return `
    <ul class="color-compatibility-list" role="list">
        <li class="main-compatibility">
            Sufficient contrast with ${data.textOptions} text colour${
    data.textOptions !== 1 ? "s" : ""
  }:
            <ul class="contrast-breakdown" role="list">
                <li class="aaa-count" title="Enhanced contrast (7:1+)">
                    ${aaaCount} at AAA level
                </li>
                <li class="aa-count" title="Standard contrast (4.5:1 to 6.9:1)">
                    ${aaCount} at AA level
                </li>
            </ul>
        </li>
        <li class="graphic-options">
            Sufficient contrast with ${data.graphicOptions} graphic colour${
    data.graphicOptions !== 1 ? "s" : ""
  }.
        </li>
    </ul>
    `;
})()}
        </span>
    </span>
        <button class="show-combinations" aria-expanded="false" 
                                                        aria-controls="combinations-${data.hex.substring(
                                                          1
                                                        )}">
                                                    Show colours with sufficient contrast
                                                </button>
<div id="combinations-${data.hex.substring(1)}" 
     class="combinations-panel" hidden>
    <h5>Colours with sufficient contrast</h5>
    <div class="compatible-colors">
        <div class="text-colors">
            ${this.renderCompatibleColors(
              data.colorSet.textColors,
              data.hex,
              "text"
            )}
        </div>
        <div class="graphic-colors">
            <h5>Graphic Colours</h5>
            ${this.renderCompatibleColors(
              data.colorSet.graphicColors,
              data.hex,
              "graphic"
            )}
        </div>
    </div>
</div>
                                            </div>
                                        </span>
                                    </li>
                                `
                                  )
                                  .join("")}
                            </ul>
                        </div>
                    </div>

                    <div class="invalid-backgrounds-section">
                        <button class="toggle-backgrounds" aria-expanded="false" aria-controls="invalidBackgroundsList">
                            Show background colours we cannot use (${
                              invalidBackgrounds.length
                            })
                        </button>
                        <div id="invalidBackgroundsList" class="backgrounds-list" hidden>
                            <h4>Background colours we cannot use</h4>
                            <ul class="color-swatches" role="list">
                                ${invalidBackgrounds
                                  .map(
                                    (color) => `
                                    <li class="color-swatch-item">
                                        <span class="color-swatch Trichromacy" 
                                              style="background-color: ${color.hex};"
                                              role="presentation"></span>
                                        <span class="color-info">
                                            <span class="color-name">${color.name}</span>
                                            <span class="color-value">${color.hex}</span>
                                            <span class="color-reason" role="note">${color.reason}.</span>
                                        </span>
                                    </li>
                                `
                                  )
                                  .join("")}
                            </ul>
                        </div>
                    </div>
                </div>
            `;
      } catch (error) {
        console.error("Error generating backgrounds display:", error);
        backgroundsSection = "";
      }
    }

    statsContainer.innerHTML = statsHtml + backgroundsSection;

    // Add event listeners for toggle buttons
    const toggleButtons = statsContainer.querySelectorAll(
      ".toggle-backgrounds, .show-combinations"
    );
    toggleButtons.forEach((button) => {
      const targetId = button.getAttribute("aria-controls");
      const targetList = document.getElementById(targetId);

      if (button && targetList) {
        button.addEventListener("click", () => {
          const isExpanded = button.getAttribute("aria-expanded") === "true";
          button.setAttribute("aria-expanded", !isExpanded);
          targetList.hidden = isExpanded;

          // Add this part to also toggle the explanation
          const explanation = targetList.querySelector(
            ".versatility-explanation"
          );
          if (explanation) {
            explanation.style.display = isExpanded ? "none" : "block";
          }

          // Handle grid layout for combination panels
          if (button.classList.contains("show-combinations")) {
            const colorSwatchesList = button.closest(".color-swatches");
            if (colorSwatchesList) {
              colorSwatchesList.classList.toggle("expanded-view", !isExpanded);
            }
            // Update button text for show combinations
            button.textContent = isExpanded
              ? "Show colours with sufficient contrast"
              : "Hide colours with sufficient contrast";
          } else if (button.classList.contains("toggle-backgrounds")) {
            // Existing code for toggle backgrounds button
            button.textContent = button.textContent.replace(
              isExpanded ? "Hide" : "Show",
              isExpanded ? "Show" : "Hide"
            );
          }
        });
      }
    });
  } // displayUploadStats ends

  /**
   * Displays error messages accessibly
   * @param {string} message - Error message to display
   */
  displayError(message) {
    console.error("Displaying error:", message);
    displayNotification(message, "error");
  }

  /**
   * Clears error messages
   */
  clearError() {
    const messageDiv = document.getElementById("myMessage");
    if (messageDiv) {
      messageDiv.style.display = "none";
      document.getElementById("pageMessage").textContent = "";
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
      console.warn("Screen reader results element not found");
      return;
    }

    const textContrastRatio = chroma
      .contrast(textColor, backgroundColor)
      .toFixed(2);
    const textWCAG = this.getWcagRating(textContrastRatio);

    let srText = `New color combination selected. `;
    srText += `Background color is ${this.getColorName(
      backgroundColor
    )} (${backgroundColor}). `;
    srText += `Text color is ${this.getColorName(textColor)} (${textColor}) `;
    srText += `with contrast ratio ${textContrastRatio}:1, WCAG level ${textWCAG}. `;

    graphicColors.forEach((color, index) => {
      const contrastRatio = chroma.contrast(color, backgroundColor).toFixed(2);
      const wcagRating = this.getWcagRating(contrastRatio);
      srText += `Graphic element ${index + 1} uses ${this.getColorName(
        color
      )} (${color}) `;
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
    if (contrastRatio >= 7) return "AAA";
    if (contrastRatio >= 4.5) return "AA";
    if (contrastRatio >= 3) return "G";
    return "F";
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
    const liveRegion = document.getElementById("colorSelectionAnnouncement");
    if (liveRegion) {
      liveRegion.textContent = `${colorName} ${
        isSelected ? "selected" : "unselected"
      }`;
    }
  }

  /**
   * Announce bulk selection changes to screen readers
   * @param {string} selectionType - Type of selection ('all' or 'none')
   */
  announceSelectionChange(selectionType) {
    const liveRegion = document.getElementById("colorSelectionAnnouncement");
    if (liveRegion) {
      liveRegion.textContent = `${
        selectionType === "all"
          ? "All colors selected"
          : "All colors unselected"
      }`;
    }
  }

  /**
   * Initializes hold buttons with SVG icons
   */
  initializeHoldButtons() {
    console.log("Initializing hold buttons");
    const holdButtons = document.querySelectorAll(".hold-button");

    holdButtons.forEach((button) => {
      button.addEventListener("click", (e) => {
        const colorType = button.dataset.colorType;
        const targetId = button.dataset.colorTarget;
        const colorElement = document.getElementById(targetId);
        const computedStyle = window.getComputedStyle(colorElement);
        const backgroundColor = computedStyle.backgroundColor;

        const hexColor = this.rgbToHex(backgroundColor);
        const isNowHeld = this.colorStorage.toggleHoldColor(
          colorType,
          hexColor
        );
        this.updateHoldButtonIcons();
        this.announceHoldStateChange(colorType, isNowHeld);
      });
    });

    this.updateHoldButtonIcons();
  }

  /**
   * Updates the hold button icons based on their pressed state
   */
  updateHoldButtonIcons() {
    const holdButtons = document.querySelectorAll(".hold-button");

    holdButtons.forEach((button) => {
      const colorType = button.dataset.colorType;
      const isHeld = this.colorStorage.isColorHeld(colorType);

      button.setAttribute("aria-pressed", isHeld);
      button.innerHTML = "";

      const iconUse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      iconUse.setAttribute("width", "20");
      iconUse.setAttribute("height", "20");
      iconUse.setAttribute("aria-hidden", "true");
      iconUse.setAttribute("focusable", "false");

      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "href",
        isHeld ? "#icon-lock" : "#icon-unlock"
      );

      iconUse.appendChild(use);

      const srText = document.createElement("span");
      srText.className = "visually-hidden";
      srText.textContent = `${isHeld ? "Unlock" : "Lock"} ${colorType} color`;

      button.appendChild(iconUse);
      button.appendChild(srText);
    });
  }

  /**
   * Convert RGB color to Hex format
   * @param {string} rgb - RGB color string
   * @returns {string} Hex color string
   */
  rgbToHex(rgb) {
    const values = rgb.match(/\d+/g);
    if (!values || values.length !== 3) return null;

    const r = parseInt(values[0]);
    const g = parseInt(values[1]);
    const b = parseInt(values[2]);

    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = x.toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
        .toUpperCase()
    );
  }

  /**
   * Announce hold state changes to screen readers
   * @param {string} colorType - Type of color being held/released
   * @param {boolean} isHeld - Whether the color is now held
   */
  announceHoldStateChange(colorType, isHeld) {
    const srResults = document.getElementById("srResults");
    if (srResults) {
      const colorName = this.colorStorage.getColorName(
        this.colorStorage.getHeldColor(colorType)
      );
      const action = isHeld ? "held" : "released";
      srResults.textContent = `${colorType} color ${colorName} ${action}`;
    }
  }
  /**
   * Toggles the disabled state of all color selection checkboxes
   * @param {boolean} disabled - Whether the checkboxes should be disabled
   */
  toggleColorCheckboxes(disabled) {
    // Get all checkboxes in the color management section
    const colorCheckboxes = document.querySelectorAll(
      '#colorList input[type="checkbox"]'
    );
    const selectAllCheckbox = document.getElementById("selectAllColors");

    // Update disabled state for all color checkboxes
    colorCheckboxes.forEach((checkbox) => {
      checkbox.disabled = disabled;
      // Update aria-label to explain why it's disabled
      if (disabled) {
        checkbox.setAttribute(
          "aria-label",
          `${checkbox.nextElementSibling.nextElementSibling.textContent} - Unavailable while background colour is locked`
        );
      } else {
        checkbox.removeAttribute("aria-label");
      }
    });

    // Also update the "Select all" checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.disabled = disabled;
      if (disabled) {
        selectAllCheckbox.setAttribute(
          "aria-label",
          "Select all colours - Unavailable while background colour is locked"
        );
      } else {
        selectAllCheckbox.removeAttribute("aria-label");
      }
    }

    // Announce the state change to screen readers
    const liveRegion = document.getElementById("colorSelectionAnnouncement");
    if (liveRegion) {
      liveRegion.textContent = disabled
        ? "Colour selection disabled while background colour is locked"
        : "Colour selection enabled";
    }
  }
  /**
   * Updates the hold button icons based on their pressed state
   */
  updateHoldButtonIcons() {
    const holdButtons = document.querySelectorAll(".hold-button");

    holdButtons.forEach((button) => {
      const colorType = button.dataset.colorType;
      const isHeld = this.colorStorage.isColorHeld(colorType);

      button.setAttribute("aria-pressed", isHeld);
      button.innerHTML = "";

      const iconUse = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      iconUse.setAttribute("width", "20");
      iconUse.setAttribute("height", "20");
      iconUse.setAttribute("aria-hidden", "true");
      iconUse.setAttribute("focusable", "false");

      const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
      use.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "href",
        isHeld ? "#icon-lock" : "#icon-unlock"
      );

      iconUse.appendChild(use);

      const srText = document.createElement("span");
      srText.className = "visually-hidden";
      srText.textContent = `${isHeld ? "Unlock" : "Lock"} ${colorType} color`;

      button.appendChild(iconUse);
      button.appendChild(srText);

      // Toggle color checkboxes if this is the background color button
      if (colorType === "background") {
        this.toggleColorCheckboxes(isHeld);
      }
    });
  }
  /**
   * Calculates a versatility score for a color set
   * @param {Object} colorSet - The set of valid combinations for a background color
   * @returns {number} Score between 0 and 1
   */
  /**
   * Calculates a versatility score for a color set
   * @param {Object} colorSet - The set of valid combinations for a background color
   * @returns {number} Score between 0 and 1
   */
  calculateVersatilityScore(colorSet) {
    const totalColors = this.colorStorage.colors.length;

    // Calculate AAA text score (highest weight)
    const aaaTextColors = colorSet.textColors.filter(
      (color) =>
        chroma.contrast(colorSet.background.colourHex, color.colourHex) >= 7
    );
    const aaaScore = aaaTextColors.length / totalColors;

    // Calculate AA text score (medium weight)
    const aaTextColors = colorSet.textColors.filter((color) => {
      const contrast = chroma.contrast(
        colorSet.background.colourHex,
        color.colourHex
      );
      return contrast >= 4.5 && contrast < 7;
    });
    const aaScore = aaTextColors.length / totalColors;

    // Calculate graphic score (lowest weight)
    const graphicScore = colorSet.graphicColors.length / totalColors;

    // Weight the scores: 50% AAA, 30% AA, 20% graphics
    return aaaScore * 0.4 + aaScore * 0.35 + graphicScore * 0.25;
  }

  /**
   * Renders a list of compatible colors with contrast ratio information
   * @param {Array} colors - Array of compatible colors
   * @param {string} backgroundColor - Background color to check contrast against
   * @param {string} type - Type of colors ('text' or 'graphic')
   * @returns {string} HTML string of color swatches
   */
  renderCompatibleColors(colors, backgroundColor, type) {
    console.log("Rendering compatible colors:", {
      colors,
      backgroundColor,
      type,
    });

    if (type === "text") {
      // Split colors into AAA and AA groups
      const aaaColors = colors.filter(
        (color) => chroma.contrast(backgroundColor, color.colourHex) >= 7
      );
      const aaColors = colors.filter((color) => {
        const contrast = chroma.contrast(backgroundColor, color.colourHex);
        return contrast >= 4.5 && contrast < 7;
      });

      return `
          <div class="text-colors">
              <h5>Text Colors</h5>
              <ul class="text-compatibility" role="list">
                  <li class="text-options">
                      <ul class="contrast-breakdown" role="list">
                          <li class="contrast-level">
                              <span class="aaa-count" title="Enhanced contrast (7:1+)">${
                                aaaColors.length
                              } at AAA level</span>
                          </li>
                          <li class="contrast-level">
                              <span class="aa-count" title="Standard contrast (4.5:1 to 6.9:1)">${
                                aaColors.length
                              } at AA level</span>
                          </li>
                      </ul>
                  </li>
              </ul>
              ${this.renderColorDetailsList(
                aaaColors,
                backgroundColor,
                "Enhanced Contrast (7:1+)"
              )}
              ${this.renderColorDetailsList(
                aaColors,
                backgroundColor,
                "Standard Contrast (4.5:1 to 6.9:1)"
              )}
          </div>
      `;
    } else {
      // For graphic colors
      return `
          <div class="graphic-colors">
              <ul class="graphics-compatibility" role="list">
                  <li class="graphic-options">
                      Sufficient contrast with ${colors.length} graphic colour${
        colors.length !== 1 ? "s" : ""
      }.
                  </li>
              </ul>
              ${this.renderColorDetailsList(colors, backgroundColor, "")}
          </div>
      `;
    }
  }

  /**
   * Helper method to render a list of color details
   * @param {Array} colors - Array of colors to render
   * @param {string} backgroundColor - Background color to check contrast against
   * @param {string} title - Title for the section
   * @returns {string} HTML string of color details list
   */
  renderColorDetailsList(colors, backgroundColor, title) {
    if (colors.length === 0) return "";

    return `
      ${title ? `<h6>${title}</h6>` : ""}
      <ul class="compatible-color-list" role="list">
          ${colors
            .map(
              (color) => `
              <li>
                  <span class="color-swatch mini Trichromacy" 
                        style="background-color: ${color.colourHex};"
                        role="presentation"></span>
                  <span class="color-details">
                      <span class="color-name">${color.name}</span>
                      <span class="contrast-ratio">(${chroma
                        .contrast(backgroundColor, color.colourHex)
                        .toFixed(1)}:1)</span>
                  </span>
              </li>
          `
            )
            .join("")}
      </ul>
  `;
  }
} // End of UIManager class
