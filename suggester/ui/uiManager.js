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
// Add this import at the top of uiManager.js
import { TemplateBuilder } from "../templates/templateBuilder.js";

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
  /**
   * Create and update the color management UI with improved accessibility
   * @param {Array} colors Array of color objects
   * @param {Set} activeColors Set of currently active color hexes
   * @param {Function} onColorToggle Callback for when a color is toggled
   * @param {Function} onToggleAll Callback for when select all/none is toggled
   */
  updateColorManagementUI(colors, activeColors, onColorToggle, onToggleAll) {
    const container = document.getElementById("colorManagement");
    if (!container) {
      console.warn("Colour management container not found");
      return;
    }

    // Generate HTML using TemplateBuilder
    container.innerHTML = TemplateBuilder.buildColorManagementUI(
      colors,
      activeColors
    );

    // Set up event listeners after HTML is inserted
    this.initializeColorManagementEvents(onColorToggle, onToggleAll);
  }

  /**
   * Initialize event listeners for color management UI
   * @param {Function} onColorToggle Callback for individual color toggle
   * @param {Function} onToggleAll Callback for select all toggle
   */
  initializeColorManagementEvents(onColorToggle, onToggleAll) {
    const selectAllCheckbox = document.getElementById("selectAllColors");
    const colorList = document.getElementById("colorList");

    if (selectAllCheckbox && colorList) {
      // Handle select all checkbox
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

      // Handle individual color checkboxes
      colorList.addEventListener("change", (e) => {
        const checkbox = e.target;
        if (checkbox.type === "checkbox" && checkbox.id.startsWith("color-")) {
          const colorHex = checkbox.id.replace("color-", "");
          onColorToggle(colorHex);
          this.announceColorSelection(
            checkbox.nextElementSibling.nextElementSibling.textContent,
            checkbox.checked
          );
          this.updateSelectAllState();
        }
      });
    }
  }

  /**
   * Update select all checkbox state based on individual checkboxes
   */
  updateSelectAllState() {
    const selectAllCheckbox = document.getElementById("selectAllColors");
    const colorCheckboxes = document.querySelectorAll(
      '#colorList input[type="checkbox"]'
    );

    if (selectAllCheckbox && colorCheckboxes.length > 0) {
      const allChecked = Array.from(colorCheckboxes).every((cb) => cb.checked);
      selectAllCheckbox.checked = allChecked;
    }
  }

  /**
   * Displays upload statistics and both valid and invalid background colors
   * @param {Object} stats - Statistics about color combinations
   */
  /**
   * Displays upload statistics and both valid and invalid background colors
   * @param {Object} stats Statistics about color combinations
   */
  displayUploadStats(stats) {
    console.log("Displaying upload stats:", stats);
    const statsContainer = document.getElementById("uploadStats");
    if (!statsContainer) {
      console.warn("Stats container not found");
      return;
    }

    try {
      // Get valid and invalid backgrounds data
      const validBackgrounds = this.colorStorage
        .getValidBackgroundsWithNames()
        .map((color) => {
          const colorSet = this.colorStorage.validColorSets.get(color.hex);
          const rawScore = this.calculateVersatilityScore(colorSet);
          const versatilityScore = Number(rawScore.toFixed(4));

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

      const invalidBackgrounds =
        this.colorStorage.getInvalidBackgroundsWithNames();

      // Generate HTML using TemplateBuilder
      statsContainer.innerHTML = TemplateBuilder.buildUploadStats(
        stats,
        validBackgrounds,
        invalidBackgrounds
      );

      // Add event listeners for toggle buttons
      this.initializeToggleButtons(statsContainer);
    } catch (error) {
      console.error("Error generating backgrounds display:", error);
      statsContainer.innerHTML = "";
    }
  }

  /**
   * Initialize toggle buttons for expandable sections
   * @param {HTMLElement} container Container element with toggle buttons
   */
  initializeToggleButtons(container) {
    const toggleButtons = container.querySelectorAll(
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

          // Handle grid layout for combination panels
          if (button.classList.contains("show-combinations")) {
            const colorSwatchesList = button.closest(".color-swatches");
            if (colorSwatchesList) {
              colorSwatchesList.classList.toggle("expanded-view", !isExpanded);
            }
            // Update button text
            button.textContent = isExpanded
              ? "Show colours with sufficient contrast"
              : "Hide colours with sufficient contrast";
          } else {
            // Update toggle backgrounds button text
            button.textContent = button.textContent.replace(
              isExpanded ? "Hide" : "Show",
              isExpanded ? "Show" : "Hide"
            );
          }
        });
      }
    });

    // Handle versatility explanation visibility
    const toggleButton = container.querySelector(".toggle-backgrounds");
    const explanation = container.querySelector(".versatility-explanation");

    if (toggleButton && explanation) {
      explanation.style.display =
        toggleButton.getAttribute("aria-expanded") === "true"
          ? "block"
          : "none";

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (
            mutation.type === "attributes" &&
            mutation.attributeName === "aria-expanded"
          ) {
            explanation.style.display =
              toggleButton.getAttribute("aria-expanded") === "true"
                ? "block"
                : "none";
          }
        });
      });

      observer.observe(toggleButton, { attributes: true });
    }
  }

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
   * Initializes hold buttons with SVG icons and event listeners
   */
  initializeHoldButtons() {
    console.log("Initializing hold buttons");
    const holdButtons = document.querySelectorAll(".hold-button");

    holdButtons.forEach((button) => {
      // Remove old listener if it exists
      button.removeEventListener("click", this.handleHoldButtonClick);
      // Add new click listener
      button.addEventListener("click", (e) => this.handleHoldButtonClick(e));
    });

    this.updateHoldButtonIcons();
  }

  /**
   * Handle hold button click events
   * @param {Event} e Click event
   */
  handleHoldButtonClick(e) {
    const button = e.currentTarget;
    const colorType = button.dataset.colorType;
    const targetId = button.dataset.colorTarget;
    const colorElement = document.getElementById(targetId);

    if (colorElement) {
      const computedStyle = window.getComputedStyle(colorElement);
      const backgroundColor = computedStyle.backgroundColor;
      const hexColor = this.rgbToHex(backgroundColor);

      if (hexColor) {
        const isNowHeld = this.colorStorage.toggleHoldColor(
          colorType,
          hexColor
        );
        this.updateHoldButtonIcons();
        this.announceHoldStateChange(colorType, isNowHeld);
      }
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

      // Update button attributes
      button.setAttribute("aria-pressed", isHeld);
      button.setAttribute(
        "aria-label",
        `${isHeld ? "Unlock" : "Lock"} ${colorType} colour`
      );

      // Update button content without replacing the whole button
      button.innerHTML = TemplateBuilder.buildHoldButtonContent({
        colorType,
        isHeld,
      });

      // Toggle color checkboxes if this is the background color button
      if (colorType === "background") {
        this.toggleColorCheckboxes(isHeld);
      }
    });
  }

  /**
   * Convert RGB color to Hex format
   * @param {string} rgb RGB color string
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
   * @param {string} colorType Type of color being held/released
   * @param {boolean} isHeld Whether the color is now held
   */
  announceHoldStateChange(colorType, isHeld) {
    const colorName = this.colorStorage.getColorName(
      this.colorStorage.getHeldColor(colorType)
    );

    const announcement = TemplateBuilder.buildHoldStatusAnnouncement(
      colorType,
      colorName,
      isHeld
    );

    const container = document.getElementById("srResults");
    if (container) {
      container.innerHTML = announcement;
    }
  }

  /**
   * Toggles the disabled state of all color selection checkboxes
   * @param {boolean} disabled Whether the checkboxes should be disabled
   */
  toggleColorCheckboxes(disabled) {
    const colorCheckboxes = document.querySelectorAll(
      '#colorList input[type="checkbox"]'
    );
    const selectAllCheckbox = document.getElementById("selectAllColors");

    // Update disabled state for all color checkboxes
    colorCheckboxes.forEach((checkbox) => {
      checkbox.disabled = disabled;

      if (disabled) {
        const label =
          checkbox.nextElementSibling.nextElementSibling.textContent;
        const message = TemplateBuilder.buildLockedStateMessage(label);
        checkbox.insertAdjacentHTML("afterend", message);
      } else {
        const message = checkbox.nextElementSibling;
        if (message?.classList.contains("sr-only")) {
          message.remove();
        }
      }
    });

    // Update the "Select all" checkbox
    if (selectAllCheckbox) {
      selectAllCheckbox.disabled = disabled;
      if (disabled) {
        const message =
          TemplateBuilder.buildLockedStateMessage("Select all colours");
        selectAllCheckbox.insertAdjacentHTML("afterend", message);
      }
    }

    // Announce the state change
    const announcement = disabled
      ? "Colour selection disabled while background colour is locked"
      : "Colour selection enabled";

    this.announceToScreenReader(announcement);
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
   * Displays compatible colors with contrast information
   * @param {Array} colors Array of compatible colors
   * @param {string} backgroundColor Background color to check against
   * @param {string} type Type of colors ('text' or 'graphic')
   */
  displayCompatibleColors(colors, backgroundColor, type) {
    const container = document.querySelector(`.${type}-colors-container`);
    if (!container) {
      console.warn(`Container for ${type} colors not found`);
      return;
    }

    // Use TemplateBuilder to generate HTML
    container.innerHTML = TemplateBuilder.buildCompatibleColorsDisplay(
      colors,
      backgroundColor,
      type
    );

    // Announce to screen readers
    const count = colors.length;
    const message = `${count} compatible ${type} color${
      count !== 1 ? "s" : ""
    } displayed`;
    this.announceToScreenReader(message);
  }

  /**
   * Helper method to announce changes to screen readers
   * @param {string} message Message to announce
   */
  announceToScreenReader(message) {
    if (this.elements.srResults) {
      this.elements.srResults.textContent = message;
    }
  }
} // End of UIManager class
