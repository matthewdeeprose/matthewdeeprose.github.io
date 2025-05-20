/**
 * CVD Contrast Checker
 * This script enhances the Colour Vision Deficiency Palette tool by adding contrast checking functionality.
 * It allows users to select a background colour and check the contrast ratios of palette colours against it.
 * Features include:
 * - Visual indicators for contrast compliance
 * - Suggestions for alternative colours with better contrast
 * - Different display modes for text and graphical objects
 * - Palette optimization for accessibility compliance
 *
 * @requires chroma.js
 * @author University Web Accessibility Team
 */

document.addEventListener("DOMContentLoaded", function () {
  // Initialize the contrast checker when DOM is fully loaded
  initContrastChecker();
});
/**
 * Helper function to ensure hex colour codes are always displayed in uppercase
 * @param {string} color - The colour code to format
 * @returns {string} - Properly formatted uppercase hex colour code
 */
function formatHexForDisplay(color) {
  // Return empty string if no color is provided
  if (!color) return "";

  // If it's already a hex code with or without #
  if (color.match(/^#?[0-9A-Fa-f]{3,6}$/)) {
    // Make sure it has the # prefix
    const formattedColor = color.charAt(0) !== "#" ? "#" + color : color;
    // Convert to uppercase
    return formattedColor.toUpperCase();
  }

  // Return the original for non-hex colours (like 'rgb' values)
  return color;
}
/**
 * Initialize the contrast checker functionality
 * This sets up event listeners and creates necessary UI elements
 */
function initContrastChecker() {
  console.log("Initializing contrast checker...");

  // Remove any existing background selectors with the old structure
  removeOldBackgroundSelectors();

  // Add background selector UI to existing palette sections
  addBackgroundSelectors();

  // Initialize the contrast column for existing tables
  initContrastColumns();

  // Add event listeners to the background colour control
  setupBackgroundControls();

  // Add display mode selectors
  setupDisplayModeSelectors();

  // Initialize the palette optimizer
  initPaletteOptimizer();

  // Initialize background checkbox states
  initBackgroundCheckboxes();

  console.log("Contrast checker initialization complete");
}

/**
 * Remove any existing background selectors with the old structure
 * This prevents duplicate selectors from being created
 */
function removeOldBackgroundSelectors() {
  // Find any existing background selectors that are direct children of details elements
  const oldSelectors = document.querySelectorAll(".background-selector");
  oldSelectors.forEach((selector) => {
    // Check if this is an old selector (not in the color-input div)
    const colorInputParent = selector.closest(".color-input");
    if (!colorInputParent && selector.closest("#customPaletteSection")) {
      console.log("Removing old background selector from outside color-input");
      selector.remove();
    }
  });
}
/**
 * Add background colour selectors to each palette section
 * This creates the UI elements for selecting a background colour
 */
function addBackgroundSelectors() {
  console.log("Adding background selectors...");

  // For custom palette section, add to color-input div
  const customPaletteSection = document.getElementById("customPaletteSection");
  if (customPaletteSection) {
    const colorInputDiv = customPaletteSection.querySelector(".color-input");
    if (colorInputDiv) {
      // Check if a background selector already exists
      if (!colorInputDiv.querySelector(".background-selector")) {
        const backgroundSelector = createBackgroundSelector("custom");
        const fieldset = colorInputDiv.querySelector("fieldset");

        if (fieldset) {
          fieldset.appendChild(backgroundSelector);
          console.log(
            "Added background selector to custom palette color-input fieldset"
          );
        } else {
          colorInputDiv.appendChild(backgroundSelector);
          console.log(
            "Added background selector to custom palette color-input div"
          );
        }
      } else {
        console.log("Background selector already exists in custom palette");
      }
    } else {
      console.log("Could not find color-input div in custom palette section");
    }
  }

  // For built-in palette sections, find a suitable location
  const builtInPaletteSections = document.querySelectorAll(
    "#insertHere section"
  );
  builtInPaletteSections.forEach((section, index) => {
    const sectionId = section.id || `palette-section-${index}`;

    // If section already has a background selector, skip it
    if (section.querySelector(".background-selector")) {
      console.log(`Section ${sectionId} already has a background selector`);
      return;
    }

    // For built-in palettes, add after the h2
    const h2 = section.querySelector("h2");
    if (h2) {
      const backgroundSelector = createBackgroundSelector(sectionId);
      h2.insertAdjacentElement("afterend", backgroundSelector);
      console.log(`Added background selector after h2 in section ${sectionId}`);
    } else {
      console.log(`Could not find h2 in section ${sectionId}`);
    }
  });
}

/**
 * Create a background selector UI component
 * @param {string} sectionId - The ID of the section to create a selector for
 * @returns {HTMLElement} - The background selector element
 */
function createBackgroundSelector(sectionId) {
  const container = document.createElement("div");
  container.className = "background-selector";
  container.setAttribute("data-section", sectionId);

  const content = document.createElement("div");
  content.className = "background-options";

  // Create the checkbox for enabling/disabling background
  const checkboxContainer = document.createElement("div");
  checkboxContainer.className = "enable-background";

  // Create a container for the label and checkbox pair
  const labelCheckboxPair = document.createElement("div");
  labelCheckboxPair.className = "checkbox-pair";

  const checkboxLabel = document.createElement("label");
  checkboxLabel.setAttribute("for", `enable-bg-${sectionId}`);
  checkboxLabel.textContent = "I want to specify a background colour.";

  const checkbox = document.createElement("input");
  checkbox.setAttribute("type", "checkbox");
  checkbox.setAttribute("id", `enable-bg-${sectionId}`);
  checkbox.className = "enable-background-checkbox";

  // Set initial disabled state based on whether palettes exist
  // This assumes there's a global palettes object or a way to check if palettes exist
  if (typeof window.palettes !== "undefined") {
    const hasPalettes = Object.keys(window.palettes).length > 0;
    checkbox.disabled = !hasPalettes;
    checkbox.setAttribute("aria-disabled", (!hasPalettes).toString());
  } else {
    // Default to disabled if we can't determine the palettes state
    checkbox.disabled = true;
    checkbox.setAttribute("aria-disabled", "true");
  }

  // Append label and checkbox to their container
  labelCheckboxPair.appendChild(checkboxLabel);
  labelCheckboxPair.appendChild(checkbox);

  // Append the label-checkbox pair to the main checkbox container
  checkboxContainer.appendChild(labelCheckboxPair);

  // Add target contrast selection
  const contrastTargetContainer = document.createElement("div");
  contrastTargetContainer.className = "contrast-target-container";

  const contrastTargetLabel = document.createElement("div");
  contrastTargetLabel.className = "contrast-target-label";
  contrastTargetLabel.textContent = "Target contrast ratio:";

  contrastTargetContainer.appendChild(contrastTargetLabel);
  contrastTargetContainer.style.display = "none"; // Initially hidden

  const contrastOptions = [
    { value: "3", label: "3:1 (UI, Graphics)", isDefault: true },
    { value: "4.5", label: "4.5:1 (Text AA)" },
    { value: "7", label: "7:1 (Text AAA)" },
  ];

  const contrastTargetOptions = document.createElement("div");
  contrastTargetOptions.className = "contrast-target-options";

  contrastOptions.forEach((option) => {
    const optionContainer = document.createElement("div");
    optionContainer.className = "contrast-target-option";

    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", `contrast-target-${sectionId}`);
    radio.setAttribute("id", `contrast-${option.value}-${sectionId}`);
    radio.setAttribute("value", option.value);
    radio.className = "contrast-target-radio";
    if (option.isDefault) {
      radio.checked = true;
    }

    const optionLabel = document.createElement("label");
    optionLabel.setAttribute("for", `contrast-${option.value}-${sectionId}`);
    optionLabel.textContent = option.label;

    optionContainer.appendChild(radio);
    optionContainer.appendChild(optionLabel);
    contrastTargetOptions.appendChild(optionContainer);
  });

  contrastTargetContainer.appendChild(contrastTargetOptions);
  checkboxContainer.appendChild(contrastTargetContainer);

  // Create the colour picker for background selection
  const pickerContainer = document.createElement("div");
  pickerContainer.className = "background-picker";
  pickerContainer.style.display = "none"; // Initially hidden

  const pickerLabel = document.createElement("label");
  pickerLabel.setAttribute("for", `bg-colour-${sectionId}`);
  pickerLabel.textContent = "Background colour:";

  const picker = document.createElement("input");
  picker.setAttribute("type", "color");
  picker.setAttribute("id", `bg-colour-${sectionId}`);
  picker.setAttribute("value", "#FFFFFF");
  picker.className = "background-colour-picker";

  const hexInput = document.createElement("input");
  hexInput.setAttribute("type", "text");
  hexInput.setAttribute("id", `bg-hex-${sectionId}`);
  hexInput.setAttribute("value", "#FFFFFF");
  hexInput.setAttribute("placeholder", "e.g. #FFFFFF or FFFFFF");
  hexInput.className = "background-hex-input";

  pickerContainer.appendChild(pickerLabel);
  pickerContainer.appendChild(picker);
  pickerContainer.appendChild(hexInput);

  // Create display mode selector
  const displayModeContainer = document.createElement("div");
  displayModeContainer.className = "display-mode-selector";
  displayModeContainer.style.display = "none"; // Initially hidden

  const displayModeLabel = document.createElement("div");
  displayModeLabel.textContent = "Show examples as:";
  displayModeLabel.className = "display-mode-label";

  const displayModeOptions = document.createElement("div");
  displayModeOptions.className = "display-mode-options";

  const modes = [
    { id: "text", label: "Text", value: "text", minContrast: 4.5 },
    {
      id: "graphic",
      label: "Graphic element",
      value: "graphic",
      minContrast: 3,
    },
    { id: "none", label: "Colour alone", value: "none", minContrast: 3 },
  ];

  modes.forEach((mode, i) => {
    const optionContainer = document.createElement("div");
    optionContainer.className = "display-mode-option";
    optionContainer.setAttribute("data-min-contrast", mode.minContrast);

    const radio = document.createElement("input");
    radio.setAttribute("type", "radio");
    radio.setAttribute("name", `display-mode-${sectionId}`);
    radio.setAttribute("id", `${mode.id}-mode-${sectionId}`);
    radio.setAttribute("value", mode.value);
    radio.className = "display-mode-radio";

    // Set the first valid option as default based on contrast target
    // This will be handled in the setupDisplayModeSelectors function

    const radioLabel = document.createElement("label");
    radioLabel.setAttribute("for", `${mode.id}-mode-${sectionId}`);
    radioLabel.textContent = mode.label;

    optionContainer.appendChild(radio);
    optionContainer.appendChild(radioLabel);
    displayModeOptions.appendChild(optionContainer);
  });

  displayModeContainer.appendChild(displayModeLabel);
  displayModeContainer.appendChild(displayModeOptions);

  // Add all elements to the container
  content.appendChild(checkboxContainer);
  content.appendChild(pickerContainer);
  content.appendChild(displayModeContainer);
  container.appendChild(content);

  return container;
}
/**
 * Initialize the background checkbox states based on palette existence
 * This ensures background controls are properly disabled when no palettes exist
 */
function initBackgroundCheckboxes() {
  console.log("Initializing background checkbox states...");

  // Check if palettes are available
  const hasPalettes =
    window.hasPalettes !== undefined
      ? window.hasPalettes
      : window.palettes && Object.keys(window.palettes).length > 0;

  // Update all background checkboxes
  document
    .querySelectorAll(".enable-background-checkbox")
    .forEach((checkbox) => {
      checkbox.disabled = !hasPalettes;
      checkbox.setAttribute("aria-disabled", (!hasPalettes).toString());

      // If no palettes exist, ensure related elements are hidden
      if (!hasPalettes && checkbox.checked) {
        checkbox.checked = false;

        // Find related elements
        const section = checkbox
          .closest(".background-selector")
          .getAttribute("data-section");
        const backgroundSelector = document.querySelector(
          `.background-selector[data-section="${section}"]`
        );

        if (backgroundSelector) {
          // Hide related elements
          const elementsToHide = backgroundSelector.querySelectorAll(
            ".background-picker, .display-mode-selector, .contrast-target-container"
          );

          elementsToHide.forEach((element) => {
            element.style.display = "none";
          });
        }
      }
    });

  console.log(
    `Background checkboxes initialized with state: ${
      hasPalettes ? "enabled" : "disabled"
    }`
  );
}

/**
 * Set up event listeners for background colour controls
 * This handles showing/hiding the colour picker and updating the contrast display
 */
function setupBackgroundControls() {
  // Add event listeners to all background checkboxes
  document
    .querySelectorAll(".enable-background-checkbox")
    .forEach((checkbox) => {
      checkbox.addEventListener("change", function () {
        const section = this.closest(".background-selector").getAttribute(
          "data-section"
        );
        const pickerContainer = this.closest(
          ".background-options"
        ).querySelector(".background-picker");
        const displayModeContainer = this.closest(
          ".background-options"
        ).querySelector(".display-mode-selector");

        const contrastTargetContainer = this.closest(
          ".background-options"
        ).querySelector(".contrast-target-container");

        console.log(
          `Background checkbox changed for section: ${section}, checked: ${this.checked}`
        );

        if (this.checked) {
          pickerContainer.style.display = "flex";
          displayModeContainer.style.display = "block";
          contrastTargetContainer.style.display = "block";
          // Initialize with the current background colour value
          const picker = pickerContainer.querySelector(
            ".background-colour-picker"
          );

          // Get the target contrast value
          const targetContrastRadio = this.closest(
            ".background-options"
          ).querySelector(".contrast-target-radio:checked");
          const targetContrast = targetContrastRadio
            ? parseFloat(targetContrastRadio.value)
            : 3;

          console.log(
            `Updating contrast display with color: ${picker.value} and target contrast: ${targetContrast}`
          );
          updateContrastDisplay(section, picker.value, targetContrast);
        } else {
          pickerContainer.style.display = "none";
          displayModeContainer.style.display = "none";
          contrastTargetContainer.style.display = "none";
          // Reset contrast display
          resetContrastDisplay(section);
        }
      });

      // Trigger change event for any checkboxes that are already checked (for page reload cases)
      if (checkbox.checked) {
        console.log(
          "Found pre-checked background checkbox, triggering change event"
        );
        const event = new Event("change");
        checkbox.dispatchEvent(event);
      }
    });

  // Add event listeners to target contrast radios
  document.querySelectorAll(".contrast-target-radio").forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        const section = this.closest(".background-selector").getAttribute(
          "data-section"
        );
        const targetContrast = parseFloat(this.value);

        // Get the background color
        const picker = this.closest(".background-options").querySelector(
          ".background-colour-picker"
        );

        // Only update if checkbox is checked
        const checkbox = this.closest(".background-options").querySelector(
          ".enable-background-checkbox"
        );
        if (checkbox && checkbox.checked && picker) {
          console.log(
            `Target contrast changed to ${targetContrast}, updating display`
          );
          updateContrastDisplay(section, picker.value, targetContrast);
        }
      }
    });
  });

  // Add event listeners to all background colour pickers
  document.querySelectorAll(".background-colour-picker").forEach((picker) => {
    picker.addEventListener("input", function () {
      const section = this.closest(".background-selector").getAttribute(
        "data-section"
      );
      const hexInput = this.closest(".background-picker").querySelector(
        ".background-hex-input"
      );

      // Update hex input with uppercase value
      hexInput.value = this.value.toUpperCase();

      // Get the target contrast value
      const targetContrastRadio = this.closest(
        ".background-options"
      ).querySelector(".contrast-target-radio:checked");
      const targetContrast = targetContrastRadio
        ? parseFloat(targetContrastRadio.value)
        : 3;

      // Update contrast display
      updateContrastDisplay(section, this.value, targetContrast);
    });
  });

  // Add event listeners to all hex inputs
  document.querySelectorAll(".background-hex-input").forEach((input) => {
    input.addEventListener("input", function () {
      const section = this.closest(".background-selector").getAttribute(
        "data-section"
      );
      const picker = this.closest(".background-picker").querySelector(
        ".background-colour-picker"
      );

      // Format the input value (add # if missing, convert to uppercase)
      let formattedValue = this.value.trim();
      if (formattedValue.charAt(0) !== "#") {
        formattedValue = "#" + formattedValue;
      }
      formattedValue = formattedValue.toUpperCase();

      // Validate hex colour
      if (isValidHexColor(formattedValue)) {
        // Update the input field with formatted value
        this.value = formattedValue;

        // Update colour picker
        picker.value = formattedValue;

        // Get the target contrast value
        const targetContrastRadio = this.closest(
          ".background-options"
        ).querySelector(".contrast-target-radio:checked");
        const targetContrast = targetContrastRadio
          ? parseFloat(targetContrastRadio.value)
          : 3;

        // Update contrast display
        updateContrastDisplay(section, formattedValue, targetContrast);
      }
    });

    // Handle Enter key and blur events
    input.addEventListener("keyup", function (event) {
      if (event.key === "Enter") {
        processHexInput(this);
      }
    });

    // Also process on blur (when field loses focus)
    input.addEventListener("blur", function () {
      processHexInput(this);
    });
  });

  /**
   * Process hex input to format and validate it
   * @param {HTMLElement} inputElement - The hex input element
   */
  function processHexInput(inputElement) {
    const section = inputElement
      .closest(".background-selector")
      .getAttribute("data-section");
    const picker = inputElement
      .closest(".background-picker")
      .querySelector(".background-colour-picker");

    // Format the input value
    let formattedValue = inputElement.value.trim();

    // Add # if missing
    if (formattedValue.charAt(0) !== "#") {
      formattedValue = "#" + formattedValue;
    }

    // Convert to uppercase
    formattedValue = formattedValue.toUpperCase();

    // Validate hex colour
    if (isValidHexColor(formattedValue)) {
      // Update the input field with formatted value
      inputElement.value = formattedValue;

      // Update colour picker
      picker.value = formattedValue;

      // Get the target contrast value
      const targetContrastRadio = inputElement
        .closest(".background-options")
        .querySelector(".contrast-target-radio:checked");
      const targetContrast = targetContrastRadio
        ? parseFloat(targetContrastRadio.value)
        : 3;

      // Update contrast display
      updateContrastDisplay(section, formattedValue, targetContrast);
    } else {
      // If invalid, provide visual feedback
      inputElement.classList.add("invalid-input");
      setTimeout(() => {
        inputElement.classList.remove("invalid-input");
      }, 2000);
    }
  }
}

/**
 * Set up event listeners for display mode selectors
 * This handles switching between different display modes (text, graphic, none)
 */
function setupDisplayModeSelectors() {
  // Add event listeners to contrast target radios
  document.querySelectorAll(".contrast-target-radio").forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        const section = this.closest(".background-selector").getAttribute(
          "data-section"
        );
        const targetContrast = parseFloat(this.value);

        console.log(
          `Target contrast changed to ${targetContrast} for section ${section}`
        );

        // Update visible display modes based on target contrast
        updateDisplayModeVisibility(section, targetContrast);

        // Update the contrast display with the new target
        const backgroundPicker = this.closest(
          ".background-options"
        ).querySelector(".background-colour-picker");
        if (backgroundPicker) {
          updateContrastDisplay(
            section,
            backgroundPicker.value,
            targetContrast
          );
        }
      }
    });
  });

  // Add event listeners to display mode radios
  document.querySelectorAll(".display-mode-radio").forEach((radio) => {
    radio.addEventListener("change", function () {
      if (this.checked) {
        const section = this.closest(".background-selector").getAttribute(
          "data-section"
        );
        const mode = this.value;

        // Get the target contrast
        const targetContrastRadio = this.closest(
          ".background-options"
        ).querySelector(".contrast-target-radio:checked");
        const targetContrast = targetContrastRadio
          ? parseFloat(targetContrastRadio.value)
          : 3;

        console.log(
          `Display mode changed to ${mode} for section ${section} with target contrast ${targetContrast}`
        );

        // Get the background color
        const backgroundPicker = this.closest(
          ".background-options"
        ).querySelector(".background-colour-picker");
        if (backgroundPicker) {
          // Update display mode
          updateDisplayMode(section, mode, backgroundPicker.value);
        }
      }
    });
  });
}

/**
 * Update which display modes are visible based on the target contrast
 * @param {string} section - The ID of the section to update
 * @param {number} targetContrast - The target contrast ratio
 */
function updateDisplayModeVisibility(section, targetContrast) {
  const displayModeOptions = document.querySelectorAll(
    `.background-selector[data-section="${section}"] .display-mode-option`
  );
  let hasCheckedOption = false;

  displayModeOptions.forEach((option) => {
    const minContrast = parseFloat(option.getAttribute("data-min-contrast"));
    const radio = option.querySelector('input[type="radio"]');

    if (minContrast <= targetContrast) {
      // Show this option
      option.style.display = "";

      // Keep track of whether any visible option is checked
      if (radio.checked) {
        hasCheckedOption = true;
      }
    } else {
      // Hide this option
      option.style.display = "none";

      // Uncheck if not valid for this contrast level
      if (radio.checked) {
        radio.checked = false;
      }
    }
  });

  // If no visible option is checked, check the first visible one
  if (!hasCheckedOption) {
    const firstVisibleOption = Array.from(displayModeOptions).find(
      (option) =>
        parseFloat(option.getAttribute("data-min-contrast")) <= targetContrast
    );

    if (firstVisibleOption) {
      const radio = firstVisibleOption.querySelector('input[type="radio"]');
      radio.checked = true;

      // Dispatch change event to update the display
      radio.dispatchEvent(new Event("change"));
    }
  }
}
/**
 * Initialize contrast columns for all palette tables
 * This adds the contrast ratio column to existing tables
 */
function initContrastColumns() {
  // Add contrast column to custom palette table
  const userColorTable = document.getElementById("userColorTable");
  if (userColorTable) {
    addContrastColumn(userColorTable);
  }

  // Add contrast columns to built-in palette tables
  document.querySelectorAll("#insertHere table").forEach((table) => {
    addContrastColumn(table);
  });

  // Log initialization for debugging
  console.log("Contrast columns initialized");
}

/**
 * Add a contrast column to a table
 * @param {HTMLElement} table - The table element to add the column to
 */
function addContrastColumn(table) {
  // Check if the contrast column already exists
  const headerRow = table.querySelector("thead tr");
  if (!headerRow) {
    console.error("No header row found in table", table);
    return;
  }

  // Check if the contrast column already exists
  if (!headerRow.querySelector('th[data-column="contrast"]')) {
    console.log("Adding contrast column to table", table.id || "unnamed table");

    // Create the new header
    const contrastHeader = document.createElement("th");
    contrastHeader.setAttribute("scope", "col");
    contrastHeader.setAttribute("role", "columnheader");
    contrastHeader.setAttribute("data-column", "contrast");
    contrastHeader.textContent = "Contrast";
    contrastHeader.className = "contrast-column-header";
    contrastHeader.id = "Contrast";

    // Initially hide the contrast column
    contrastHeader.style.display = "none";

    // Add the header to the row
    headerRow.appendChild(contrastHeader);

    // Add a contrast cell to each row in the table body
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const contrastCell = document.createElement("td");
      contrastCell.setAttribute("data-label", "contrast");
      contrastCell.setAttribute("role", "cell");
      contrastCell.className = "contrast-cell";

      // Initially hide the contrast cell
      contrastCell.style.display = "none";

      // Add the cell to the row
      row.appendChild(contrastCell);
    });

    console.log(
      "Added contrast column with cells to table",
      table.id || "unnamed table"
    );
  } else {
    console.log(
      "Contrast column already exists in table",
      table.id || "unnamed table"
    );
  }
}

/**
 * Update the contrast display for a section
 * This calculates and displays the contrast ratios for all colours in the section
 * @param {string} section - The ID of the section to update
 * @param {string} backgroundColor - The background colour to check against
 * @param {number} [targetContrast] - Optional target contrast ratio (default: uses selected radio)
 */
function updateContrastDisplay(section, backgroundColor, targetContrast) {
  console.log(
    `Updating contrast display for section: ${section}, background: ${backgroundColor}`
  );

  // Get the table for this section
  let table;
  if (section === "custom") {
    table = document.getElementById("userColorTable");
  } else {
    // Find the table within the section
    const sectionElement = document.getElementById(section);
    if (sectionElement) {
      table = sectionElement.querySelector("table");
    }
  }

  if (!table) {
    console.error(`Table not found for section: ${section}`);
    return;
  }

  console.log(`Found table for section: ${section}`, table);

  // If targetContrast is not provided, get it from the radio button
  if (targetContrast === undefined) {
    const contrastRadio = document.querySelector(
      `.background-selector[data-section="${section}"] .contrast-target-radio:checked`
    );
    targetContrast = contrastRadio ? parseFloat(contrastRadio.value) : 3;
  }

  console.log(`Using target contrast: ${targetContrast}`);

  // Ensure contrast column exists
  addContrastColumn(table);

  // Show the contrast column
  const contrastHeader = table.querySelector('th[data-column="contrast"]');
  if (contrastHeader) {
    contrastHeader.style.display = "";
    console.log(
      `Showing contrast header for table: ${table.id || "unnamed table"}`
    );
  } else {
    console.error(
      `Contrast header not found in table: ${table.id || "unnamed table"}`
    );
    // If we still don't have the contrast header, it's likely something went wrong with column creation
    console.log("Retrying to add contrast column...");
    addContrastColumn(table);

    // Now try to get the header again
    const newHeader = table.querySelector('th[data-column="contrast"]');
    if (newHeader) {
      newHeader.style.display = "";
      console.log("Successfully added and showing new contrast column header");
    } else {
      console.error(
        "Failed to add contrast column after retry. Some functionality may be limited."
      );
    }
  }

  // Get all rows in the table
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    console.log(`No rows found in table: ${table.id || "unnamed table"}`);
    return;
  }

  rows.forEach((row, index) => {
    // Get the colour from the first cell
    const colorCell = row.querySelector("th");
    if (!colorCell) {
      console.error(`No color cell found in row ${index}`);
      return;
    }

    const color = colorCell.textContent.trim();
    console.log(`Processing color: ${color} in row ${index}`);

    // Calculate contrast
    const contrast = calculateContrast(color, backgroundColor);
    console.log(
      `Contrast for ${color} against ${backgroundColor}: ${contrast}`
    );

    // Get the contrast cell for this row
    const contrastCell = row.querySelector(".contrast-cell");
    if (!contrastCell) {
      console.error(`No contrast cell found for row ${index}`);
      return;
    }

    // Show the contrast cell
    contrastCell.style.display = "";

    // Create contrast indicator
    const contrastIndicator = createContrastIndicator(contrast, targetContrast);

    // Clear previous content
    contrastCell.innerHTML = "";

    // Add the indicator
    contrastCell.appendChild(contrastIndicator);

    // Add alternative suggestion button if contrast is below target
    if (contrast < targetContrast) {
      console.log(
        `Adding suggestion button for ${color} (contrast: ${contrast}, target: ${targetContrast})`
      );
      const suggestButton = createSuggestButton(
        color,
        backgroundColor,
        targetContrast
      );
      contrastCell.appendChild(suggestButton);
    }
  });

  // Update display mode visibility based on target contrast
  updateDisplayModeVisibility(section, targetContrast);

  // Get the display mode
  const displayModeRadios = document.querySelectorAll(
    `.background-selector[data-section="${section}"] .display-mode-radio:checked`
  );
  let displayMode = null;

  if (displayModeRadios.length > 0) {
    displayMode = displayModeRadios[0].value;
  } else {
    // If no display mode is selected, find the first visible option
    const displayModeOptions = document.querySelectorAll(
      `.background-selector[data-section="${section}"] .display-mode-option`
    );
    const firstVisible = Array.from(displayModeOptions).find(
      (option) =>
        option.style.display !== "none" &&
        parseFloat(option.getAttribute("data-min-contrast")) <= targetContrast
    );

    if (firstVisible) {
      const radio = firstVisible.querySelector('input[type="radio"]');
      radio.checked = true;
      displayMode = radio.value;
    } else {
      // Fallback to 'none' if no valid option found
      displayMode = "none";
    }
  }

  console.log(`Using display mode: ${displayMode}`);

  // Update the display mode
  if (displayMode) {
    updateDisplayMode(section, displayMode, backgroundColor);
  }
}

/**
 * Reset the contrast display for a section
 * This hides the contrast column and resets the display mode
 * @param {string} section - The ID of the section to reset
 */
function resetContrastDisplay(section) {
  // Get the table for this section
  let table;
  if (section === "custom") {
    table = document.getElementById("userColorTable");
  } else {
    // Find the table within the section
    const sectionElement = document.getElementById(section);
    if (sectionElement) {
      table = sectionElement.querySelector("table");
    }
  }

  if (table) {
    // Hide the contrast column
    const contrastHeader = table.querySelector('th[data-column="contrast"]');
    if (contrastHeader) {
      contrastHeader.style.display = "none";
    }

    // Hide all contrast cells
    const contrastCells = table.querySelectorAll(".contrast-cell");
    contrastCells.forEach((cell) => {
      cell.style.display = "none";
    });

    // Reset the display in all cells
    const cells = table.querySelectorAll("td.paletteExampleCell");
    cells.forEach((cell) => {
      // Reset to original state
      if (cell.querySelector(".example-display")) {
        cell.innerHTML = "Example";
      }

      // Reset background colour
      const colorCell = cell.closest("tr").querySelector("th");
      if (colorCell) {
        const color = colorCell.textContent.trim();
        cell.style.backgroundColor = color;
        cell.style.color = color;
      }
    });
  }
}

/**
 * Update the display mode for a section
 * This changes how the colours are displayed in the cells (text, graphic, none)
 * @param {string} section - The ID of the section to update
 * @param {string} mode - The display mode to use
 * @param {string} backgroundColor - The background colour to use
 */
function updateDisplayMode(section, mode, backgroundColor) {
  // Get the table for this section
  let table;
  if (section === "custom") {
    table = document.getElementById("userColorTable");
  } else {
    // Find the table within the section
    const sectionElement = document.getElementById(section);
    if (sectionElement) {
      table = sectionElement.querySelector("table");
    }
  }

  if (table) {
    // Get all example cells in the table
    const cells = table.querySelectorAll("td.paletteExampleCell");
    cells.forEach((cell) => {
      // Get the colour from the row
      const colorCell = cell.closest("tr").querySelector("th");
      if (colorCell) {
        const color = colorCell.textContent.trim();

        // Update the cell display based on mode
        switch (mode) {
          case "text":
            cell.innerHTML = '<div class="example-display">Example Text</div>';
            cell.querySelector(".example-display").style.color = color;
            cell.style.backgroundColor = backgroundColor;
            cell.style.color = ""; // Reset to default
            break;
          case "graphic":
            cell.innerHTML =
              '<div class="example-display"><span><span class="sr-only">Example icon</span><span id="icon1" class="infoIcon" style="font-size:3rem" aria-hidden="true">❅</span></span></div>';
            cell.querySelector(".example-display").style.color = color;
            cell.style.backgroundColor = backgroundColor;
            cell.style.color = ""; // Reset to default
            break;
          case "none":
          default:
            cell.innerHTML = '<div class="example-display">Example Text</div>';
            cell.querySelector(".example-display").style.color = color;
            cell.style.backgroundColor = color;
            cell.style.color = ""; // Reset to default
            break;
        }
      }
    });
  }
}

/**
 * Calculate the contrast ratio between two colours
 * @param {string} color1 - The first colour (foreground)
 * @param {string} color2 - The second colour (background)
 * @returns {number} - The contrast ratio
 */
function calculateContrast(color1, color2) {
  try {
    // Ensure both colors are valid
    if (!color1 || !color2) {
      console.error("Invalid colours for contrast calculation", {
        color1,
        color2,
      });
      return 0;
    }

    // Only add # if it's missing AND the color doesn't start with "rgb" or "hsl"
    if (
      color1.charAt(0) !== "#" &&
      !color1.startsWith("rgb") &&
      !color1.startsWith("hsl")
    ) {
      color1 = "#" + color1;
    }

    if (
      color2.charAt(0) !== "#" &&
      !color2.startsWith("rgb") &&
      !color2.startsWith("hsl")
    ) {
      color2 = "#" + color2;
    }

    console.log(`Calculating contrast between ${color1} and ${color2}`);
    const contrast = chroma.contrast(color1, color2);
    console.log(`Contrast result: ${contrast}`);
    return contrast;
  } catch (e) {
    console.error("Error calculating contrast:", e, { color1, color2 });
    return 0;
  }
}

/**
 * Create a visual indicator for contrast ratio
 * @param {number} contrast - The contrast ratio
 * @param {number} [targetContrast=3] - The target contrast ratio
 * @returns {HTMLElement} - The contrast indicator element
 */
function createContrastIndicator(contrast, targetContrast = 3) {
  const container = document.createElement("div");
  container.className = "contrast-indicator";

  // Create the ratio display
  const ratio = document.createElement("span");
  ratio.className = "contrast-ratio";
  ratio.textContent = contrast.toFixed(2) + ":1";

  // Create the status indicator
  const status = document.createElement("span");
  status.className = "contrast-status";

  if (contrast >= 7) {
    status.className += " contrast-aaa";
    status.textContent = "✓ AAA";
    status.title = "Meets WCAG AAA (7:1) contrast requirements";
  } else if (contrast >= 4.5) {
    status.className += " contrast-aa";
    status.textContent = "✓ AA";
    status.title = "Meets WCAG AA (4.5:1) contrast requirements";
  } else if (contrast >= 3) {
    status.className += " contrast-large";
    status.textContent = "✓ Large";
    status.title = "Meets WCAG AA for large text (3:1) and graphical objects";
  } else {
    status.className += " contrast-fail-cvd";
    status.textContent = "✗ Fail";
    status.title = "Does not meet any WCAG contrast requirements";
  }

  // Add target indicator
  if (contrast >= targetContrast) {
    // Add target indicator for passed target
    const targetIndicator = document.createElement("span");
    targetIndicator.className = "target-indicator target-pass";
    targetIndicator.textContent = `✓ Meets ${targetContrast}:1 target`;
    container.appendChild(ratio);
    container.appendChild(status);
    container.appendChild(targetIndicator);
  } else {
    // Add target indicator for failed target
    const targetIndicator = document.createElement("span");
    targetIndicator.className = "target-indicator target-fail";
    targetIndicator.textContent = `✗ Below ${targetContrast}:1 target`;
    container.appendChild(ratio);
    container.appendChild(status);
    container.appendChild(targetIndicator);
  }

  return container;
}

/**
 * Create a button for suggesting alternative colours
 * @param {string} color - The original colour
 * @param {string} backgroundColor - The background colour
 * @param {number} [targetContrast=3] - The target contrast ratio
 * @returns {HTMLElement} - The suggest button element
 */
function createSuggestButton(color, backgroundColor, targetContrast = 3) {
  const button = document.createElement("button");
  button.className = "suggest-alternative-button";
  button.textContent = "Suggest alternative";
  button.setAttribute(
    "aria-label",
    `Suggest alternative colour for ${color} to meet ${targetContrast}:1 contrast`
  );
  button.title = `Suggest similar colours with at least ${targetContrast}:1 contrast`;

  // Store the target contrast as a data attribute
  button.setAttribute("data-target-contrast", targetContrast);

  // Add click event listener
  button.addEventListener("click", function () {
    const targetContrast =
      parseFloat(this.getAttribute("data-target-contrast")) || 3;
    suggestAlternatives(color, backgroundColor, this, targetContrast);
  });

  return button;
}

/**
 * Create the modal for displaying alternative colour options
 * Uses the native HTML dialog element for improved accessibility
 */
function createAlternativesModal() {
  // Check if modal already exists
  if (!document.getElementById("alternatives-modal")) {
    const modal = document.createElement("dialog");
    modal.id = "alternatives-modal";
    modal.className = "optimization-modal"; // Reuse existing modal styling
    modal.setAttribute("aria-labelledby", "alternatives-modal-title");

    // Create modal content with similar structure to optimization modal
    modal.innerHTML = `
          <div class="optimization-modal-content">
              <div class="optimization-modal-header">
                  <h3 id="alternatives-modal-title">Alternative Colour Options</h3>
                  <button class="close-modal-button" aria-label="Close alternatives dialog">×</button>
              </div>
              <div class="optimization-modal-body">
                  <div id="alternatives-summary" class="optimization-summary">
                      <p>Select an alternative colour with better contrast.</p>
                  </div>
                  <div id="alternatives-container" class="alternatives-container">
                      <!-- Alternatives will be populated here -->
                  </div>
              </div>
              <div class="optimization-modal-footer">
                  <form method="dialog">
                      <button id="cancel-alternatives-button" class="cancel-optimization-button">Cancel</button>
                  </form>
              </div>
          </div>
      `;

    // Append the modal to the document body
    document.body.appendChild(modal);

    // Add event listeners for modal buttons
    document
      .querySelector("#alternatives-modal .close-modal-button")
      .addEventListener("click", () => {
        document.body.classList.remove("modal-open");
        modal.close();
      });

    // Add event listener for the cancel button
    document
      .getElementById("cancel-alternatives-button")
      .addEventListener("click", () => {
        document.body.classList.remove("modal-open");
      });

    // Add event listeners for dialog events
    modal.addEventListener("close", () => {
      document.body.classList.remove("modal-open");

      // Re-enable the source button when the dialog is closed
      if (window.alternativesSourceButton) {
        window.alternativesSourceButton.disabled = false;
      }
    });

    // When the dialog is opened, add the modal-open class
    modal.addEventListener("showModal", () => {
      document.body.classList.add("modal-open");
    });

    console.log("Alternatives modal created");
  }
}

/**
 * Generate and display alternative colour suggestions with improved visual comparison
 * @param {string} originalColor - The original colour
 * @param {string} backgroundColor - The background colour
 * @param {HTMLElement} buttonElement - The button that triggered the suggestion
 * @param {number} [targetContrast=3] - The target contrast ratio
 */
function suggestAlternatives(
  originalColor,
  backgroundColor,
  buttonElement,
  targetContrast = 3
) {
  // Ensure the alternatives modal exists
  createAlternativesModal();

  // Generate alternatives
  const alternatives = generateAlternatives(
    originalColor,
    backgroundColor,
    targetContrast
  );

  // Get the modal and container elements
  const modal = document.getElementById("alternatives-modal");
  const container = document.getElementById("alternatives-container");
  const summary = document.getElementById("alternatives-summary");

  // Clear previous content
  container.innerHTML = "";

  // Update the summary - Use formatHexForDisplay for both colors
  summary.innerHTML = `
    <p>Alternative colours for <span class="colour-preview" style="background-color:${originalColor};"></span> <strong>${formatHexForDisplay(
    originalColor
  )}</strong></p>
    <p>Target contrast ratio: <strong>${targetContrast}:1</strong> against background <span class="colour-preview" style="background-color:${backgroundColor};"></span> <strong>${formatHexForDisplay(
    backgroundColor
  )}</strong></p>
  `;

  // Store source button reference and details globally for access when modal closes
  window.alternativesSourceButton = buttonElement;
  window.alternativesOriginalColor = originalColor;

  // Add each alternative to the container
  if (alternatives.length > 0) {
    alternatives.forEach((alt, index) => {
      const altItem = document.createElement("div");
      altItem.className = "alternative-item";

      // Create improved colour comparison section
      const comparisonContainer = document.createElement("div");
      comparisonContainer.className = "colour-comparison";

      // Original colour item
      const originalItem = document.createElement("div");
      originalItem.className = "comparison-item";

      const originalLabel = document.createElement("span");
      originalLabel.className = "comparison-label";
      originalLabel.textContent = "Original";
      originalItem.appendChild(originalLabel);

      const originalPreview = document.createElement("div");
      originalPreview.className = "colour-preview original-colour";
      originalPreview.style.backgroundColor = originalColor;
      originalPreview.setAttribute("title", "Original colour");
      originalItem.appendChild(originalPreview);

      const originalCode = document.createElement("span");
      originalCode.className = "colour-code";
      originalCode.textContent = formatHexForDisplay(originalColor);
      originalItem.appendChild(originalCode);

      // Arrow icon
      const arrowIcon = document.createElement("div");
      arrowIcon.className = "comparison-arrow";
      arrowIcon.innerHTML = "→";
      arrowIcon.setAttribute("aria-hidden", "true");

      // Alternative colour item
      const alternativeItem = document.createElement("div");
      alternativeItem.className = "comparison-item";

      const alternativeLabel = document.createElement("span");
      alternativeLabel.className = "comparison-label";
      alternativeLabel.textContent = "Alternative";
      alternativeItem.appendChild(alternativeLabel);

      const alternativePreview = document.createElement("div");
      alternativePreview.className = "colour-preview alternative-colour";
      alternativePreview.style.backgroundColor = alt.color;
      alternativePreview.setAttribute("title", "Alternative colour");
      alternativeItem.appendChild(alternativePreview);

      const alternativeCode = document.createElement("span");
      alternativeCode.className = "colour-code";
      alternativeCode.textContent = formatHexForDisplay(alt.color);
      alternativeItem.appendChild(alternativeCode);

      // Add all comparison elements
      comparisonContainer.appendChild(originalItem);
      comparisonContainer.appendChild(arrowIcon);
      comparisonContainer.appendChild(alternativeItem);
      altItem.appendChild(comparisonContainer);

      // Create before/after text sample comparison
      const comparisonExample = document.createElement("div");
      comparisonExample.className = "comparison-example";

      // Before example
      const beforeItem = document.createElement("div");
      beforeItem.className = "example-item";

      const beforeLabel = document.createElement("span");
      beforeLabel.className = "example-label";
      beforeLabel.textContent = "Before";
      beforeItem.appendChild(beforeLabel);

      const beforeSample = document.createElement("div");
      beforeSample.className = "text-sample";
      beforeSample.style.backgroundColor = backgroundColor;
      beforeSample.style.color = originalColor;
      beforeSample.textContent = "Sample Text";
      beforeSample.setAttribute(
        "aria-label",
        `Text appearance with original colour ${formatHexForDisplay(
          originalColor
        )}`
      );
      beforeItem.appendChild(beforeSample);

      // After example
      const afterItem = document.createElement("div");
      afterItem.className = "example-item";

      const afterLabel = document.createElement("span");
      afterLabel.className = "example-label";
      afterLabel.textContent = "After";
      afterItem.appendChild(afterLabel);

      const afterSample = document.createElement("div");
      afterSample.className = "text-sample";
      afterSample.style.backgroundColor = backgroundColor;
      afterSample.style.color = alt.color;
      afterSample.textContent = "Sample Text";
      afterSample.setAttribute(
        "aria-label",
        `Text appearance with alternative colour ${formatHexForDisplay(
          alt.color
        )}`
      );
      afterItem.appendChild(afterSample);

      // Add example items to comparison example
      comparisonExample.appendChild(beforeItem);
      comparisonExample.appendChild(afterItem);
      altItem.appendChild(comparisonExample);

      // Create alternative info display
      const altInfo = document.createElement("div");
      altInfo.className = "alternative-info";
      altInfo.innerHTML = `
        <div><strong>Contrast:</strong> ${alt.contrast.toFixed(2)}:1 
          <span class="${
            alt.contrast >= targetContrast ? "contrast-pass" : "contrast-fail"
          }">
            ${alt.contrast >= targetContrast ? "✓" : "✗"}
          </span>
        </div>
        <div><strong>Similarity:</strong> ${alt.similarity.toFixed(0)}%</div>
      `;
      altItem.appendChild(altInfo);

      // Create select button
      const selectButton = document.createElement("button");
      selectButton.className = "select-alternative-button";
      selectButton.textContent = "Use this colour";
      selectButton.setAttribute(
        "aria-label",
        `Use ${formatHexForDisplay(alt.color)} instead of ${formatHexForDisplay(
          originalColor
        )}`
      );
      selectButton.dataset.color = alt.color;

      // Add click event to replace the colour
      selectButton.addEventListener("click", function () {
        replaceColor(originalColor, alt.color);
        modal.close();
        // We're using the existing displayNotification function,
        // which already handles uppercase hex codes
        displayNotification(
          `Colour changed from ${originalColor} to ${alt.color}`,
          "success"
        );
      });

      altItem.appendChild(selectButton);
      container.appendChild(altItem);
    });
  } else {
    // No alternatives found
    container.innerHTML = `
      <div class="no-alternatives">
        <p>No suitable alternatives found. Try adjusting the target contrast or using the palette optimiser for more comprehensive changes.</p>
      </div>
    `;
  }

  // Disable the button while alternatives are shown
  if (buttonElement) {
    buttonElement.disabled = true;
  }

  // Show the modal
  modal.showModal();

  // Set focus to the first select button or the cancel button
  setTimeout(() => {
    const firstSelectButton = modal.querySelector(".select-alternative-button");
    if (firstSelectButton) {
      firstSelectButton.focus();
    } else {
      document.getElementById("cancel-alternatives-button").focus();
    }
  }, 50);

  // Lock scrolling if function exists
  if (typeof lockScroll === "function") {
    lockScroll();
  }
}

// Update applySingleOptimization to use formatHexForDisplay
function applySingleOptimization(index) {
  if (!window.currentOptimization) {
    console.error("No active optimization");
    return;
  }

  const { section, colourData, backgroundColor } = window.currentOptimization;
  const data = colourData[index];

  // Only apply if there's a change
  if (data.originalColor !== data.optimizedColor) {
    // Replace the colour in the palette
    replaceColor(data.originalColor, data.optimizedColor);

    // Update the row in the results table to show it's been applied
    const resultsTable = document.getElementById("optimization-results-table");
    const rows = resultsTable.querySelectorAll("tbody tr");

    if (rows[index]) {
      const actionsCell = rows[index].cells[5]; // The actions cell
      actionsCell.innerHTML = "<span>Applied</span>";

      // Update the original colour cell to show the new colour - Use formatHexForDisplay
      const originalCell = rows[index].cells[0];
      originalCell.innerHTML = `
                <span class="colour-preview" style="background-color: ${
                  data.optimizedColor
                }"></span>
                <span class="colour-code">${formatHexForDisplay(
                  data.optimizedColor
                )}</span>
            `;

      // Update the original contrast cell
      const originalContrastCell = rows[index].cells[2];
      originalContrastCell.innerHTML = `
                <span class="contrast-pass">${data.newContrast.toFixed(
                  2
                )}:1</span>
            `;

      // Update the data in the colourData array
      colourData[index].originalColor = data.optimizedColor;
      colourData[index].originalContrast = data.newContrast;
      colourData[index].needsChange = false;
    }

    // Update the optimization statistics
    updateOptimizationSummary();
  }
}

// Extend the initModalScrollLock function to include our alternatives modal
function extendScrollLockToAlternativesModal() {
  // Wait for the initModalScrollLock function to be available
  // This function is defined in the original code and handles scroll locking
  if (typeof initModalScrollLock === "function") {
    const originalInitModalScrollLock = initModalScrollLock;

    // Override the original function to also handle our alternatives modal
    window.initModalScrollLock = function () {
      // Call the original function first
      originalInitModalScrollLock();

      // Now add scroll locking to our alternatives modal
      const alternativesModal = document.getElementById("alternatives-modal");
      if (!alternativesModal) {
        console.log(
          "Alternatives modal not found, scroll lock not initialized"
        );
        return;
      }

      // Add event listeners for modal open/close
      alternativesModal.addEventListener("showModal", function () {
        lockScroll();
      });

      alternativesModal.addEventListener("close", function () {
        unlockScroll();
      });

      // Add event listeners for close buttons
      const closeButtons = alternativesModal.querySelectorAll(
        ".close-modal-button, #cancel-alternatives-button"
      );
      closeButtons.forEach((button) => {
        button.addEventListener("click", function () {
          unlockScroll();
          alternativesModal.close();
        });
      });

      console.log("Alternatives modal scroll lock initialized");
    };

    // Call the extended function
    window.initModalScrollLock();
  } else {
    console.log(
      "initModalScrollLock function not found, will try again in 500ms"
    );
    // Try again later if the function isn't available yet
    setTimeout(extendScrollLockToAlternativesModal, 500);
  }
}

/**
 * Initialize the alternatives modal when the page loads
 */
function initAlternativesModal() {
  createAlternativesModal();

  // Add event listener to handle modal closing
  const modal = document.getElementById("alternatives-modal");
  if (modal) {
    modal.addEventListener("close", function () {
      // Re-enable the button that opened this dialog
      const buttonId = this.dataset.originalButtonId;
      if (buttonId) {
        const button = document.getElementById(buttonId);
        if (button) {
          button.disabled = false;
        }
      }

      // Unlock scrolling
      if (typeof unlockScroll === "function") {
        unlockScroll();
      }
    });

    // Add event listener for when the modal opens
    modal.addEventListener("showModal", function () {
      // Lock scrolling
      if (typeof lockScroll === "function") {
        lockScroll();
      }
    });
  }
}
/**
 * Generate alternative colours with better contrast
 * @param {string} originalColor - The original colour
 * @param {string} backgroundColor - The background colour
 * @param {number} [targetContrast=3] - The target contrast ratio
 * @returns {Array} - Array of alternative colour objects
 */
function generateAlternatives(
  originalColor,
  backgroundColor,
  targetContrast = 3
) {
  const alternatives = [];

  try {
    console.log(
      `Generating alternatives for ${originalColor} against ${backgroundColor} with target contrast ${targetContrast}`
    );

    // Convert to LAB colour space for better manipulation
    const originalLab = chroma(originalColor).lab();
    const backgroundLuminance = chroma(backgroundColor).luminance();

    // Determine if we need to lighten or darken
    // If background is dark, lighten the colour; if light, darken it
    const direction = backgroundLuminance > 0.5 ? -1 : 1;

    // Try adjusting lightness to find better contrast
    for (let i = 1; i <= 10; i++) {
      const adjustment = i * 5 * direction;
      let newLab = [...originalLab];
      newLab[0] = Math.max(0, Math.min(100, originalLab[0] + adjustment));

      try {
        const newColor = chroma.lab(...newLab).hex();
        const contrast = calculateContrast(newColor, backgroundColor);
        const deltaE = chroma.deltaE(originalColor, newColor);
        const similarity = Math.max(0, 100 - deltaE);

        // Add if contrast is improved and meets the target
        if (contrast >= targetContrast) {
          alternatives.push({
            color: newColor,
            contrast: contrast,
            similarity: similarity,
          });

          // If we've reached good contrast, try some saturation variations too
          if (alternatives.length < 5) {
            // Try with more saturation
            let saturatedLab = [...newLab];
            saturatedLab[1] *= 1.2; // Increase A value
            saturatedLab[2] *= 1.2; // Increase B value

            try {
              const saturatedColor = chroma.lab(...saturatedLab).hex();
              const saturatedContrast = calculateContrast(
                saturatedColor,
                backgroundColor
              );
              const saturatedDeltaE = chroma.deltaE(
                originalColor,
                saturatedColor
              );
              const saturatedSimilarity = Math.max(0, 100 - saturatedDeltaE);

              if (saturatedContrast >= targetContrast) {
                alternatives.push({
                  color: saturatedColor,
                  contrast: saturatedContrast,
                  similarity: saturatedSimilarity,
                });
              }
            } catch (e) {
              // Invalid colour, skip
            }
          }
        }
      } catch (e) {
        // Invalid colour, skip
      }
    }

    // Try hue adjustments if we don't have enough alternatives
    if (alternatives.length < 3) {
      const originalHSL = chroma(originalColor).hsl();

      // Try different hues
      for (let hueShift = -30; hueShift <= 30; hueShift += 15) {
        if (hueShift === 0) continue; // Skip original hue

        try {
          const newHue = (originalHSL[0] + hueShift + 360) % 360;
          const newColor = chroma
            .hsl(newHue, originalHSL[1], originalHSL[2])
            .hex();
          const contrast = calculateContrast(newColor, backgroundColor);
          const deltaE = chroma.deltaE(originalColor, newColor);
          const similarity = Math.max(0, 100 - deltaE);

          // Add if contrast meets the target
          if (contrast >= targetContrast) {
            alternatives.push({
              color: newColor,
              contrast: contrast,
              similarity: similarity,
            });
          }
        } catch (e) {
          // Invalid colour, skip
        }
      }
    }

    // If we still don't have enough, try more extreme lightness adjustments
    if (alternatives.length < 3) {
      for (let i = 12; i <= 20; i += 2) {
        const adjustment = i * 5 * direction;
        let newLab = [...originalLab];
        newLab[0] = Math.max(0, Math.min(100, originalLab[0] + adjustment));

        try {
          const newColor = chroma.lab(...newLab).hex();
          const contrast = calculateContrast(newColor, backgroundColor);
          const deltaE = chroma.deltaE(originalColor, newColor);
          const similarity = Math.max(0, 100 - deltaE);

          // Add if contrast meets the target
          if (contrast >= targetContrast) {
            alternatives.push({
              color: newColor,
              contrast: contrast,
              similarity: similarity,
            });
          }
        } catch (e) {
          // Invalid colour, skip
        }
      }
    }

    console.log(
      `Generated ${alternatives.length} alternatives that meet ${targetContrast}:1 contrast target`
    );

    // Sort purely by similarity (highest first)
    alternatives.sort((a, b) => {
      return b.similarity - a.similarity;
    });

    // Limit to 5 alternatives
    return alternatives.slice(0, 5);
  } catch (e) {
    console.error("Error generating alternatives:", e);
    return [];
  }
}

/**
 * Replace a colour in the palette with a new one
 * @param {string} originalColor - The original colour to replace
 * @param {string} newColor - The new colour to use
 */
function replaceColor(originalColor, newColor) {
  // For built-in palettes, we don't actually modify the original, just update the display
  const cells = document.querySelectorAll('th[scope="row"]');
  cells.forEach((cell) => {
    if (cell.textContent.trim() === originalColor) {
      // Update the cell
      cell.textContent = newColor;

      // Update row cells
      const row = cell.closest("tr");
      if (row) {
        const displayCells = row.querySelectorAll("td.paletteExampleCell");
        displayCells.forEach((displayCell) => {
          // If display is in mode "none", update cell background
          if (!displayCell.querySelector(".example-display")) {
            displayCell.style.backgroundColor = newColor;
            displayCell.style.color = newColor;
          } else {
            // Update example display
            const exampleDisplay =
              displayCell.querySelector(".example-display");
            if (exampleDisplay.querySelector("svg")) {
              // Update SVG fill and stroke
              const circle = exampleDisplay.querySelector("circle");
              const path = exampleDisplay.querySelector("path");
              if (circle) circle.setAttribute("fill", newColor);
              if (path) path.setAttribute("stroke", newColor);
            } else {
              // Update text colour
              exampleDisplay.style.color = newColor;
            }
          }
        });

        // Update contrast cell
        const contrastCell = row.querySelector(".contrast-cell");
        if (contrastCell) {
          // Get the background colour
          const cell = contrastCell
            .closest("tr")
            .querySelector("td.paletteExampleCell");
          if (cell) {
            const backgroundColor =
              window.getComputedStyle(cell).backgroundColor;

            // Calculate new contrast
            const contrast = calculateContrast(newColor, backgroundColor);

            // Clear previous content
            contrastCell.innerHTML = "";

            // Create new contrast indicator
            const contrastIndicator = createContrastIndicator(contrast);
            contrastCell.appendChild(contrastIndicator);

            // Add alternative suggestion button if contrast is poor
            if (contrast < 3) {
              const suggestButton = createSuggestButton(
                newColor,
                backgroundColor
              );
              contrastCell.appendChild(suggestButton);
            }
          }
        }

        // If this is the custom palette, update the palette data
        const userColorTable = document.getElementById("userColorTable");
        if (userColorTable && row.closest("table") === userColorTable) {
          updateCustomPalette(originalColor, newColor);
        }
      }
    }
  });
}

/**
 * Update the custom palette with a new colour
 * @param {string} originalColor - The original colour to replace
 * @param {string} newColor - The new colour to use
 */
function updateCustomPalette(originalColor, newColor) {
  // Get the current palette
  const paletteSelect = document.getElementById("paletteSelect");
  if (paletteSelect && paletteSelect.value) {
    const currentPalette = paletteSelect.value;

    // Get all palettes from window.palettes
    if (window.palettes && window.palettes[currentPalette]) {
      // Find the colour and replace it
      const index = window.palettes[currentPalette].indexOf(originalColor);
      if (index !== -1) {
        window.palettes[currentPalette][index] = newColor;
        console.log(
          `Updated colour in custom palette from ${originalColor} to ${newColor}`
        );
      }
    }
  }
}

/**
 * Check if a string is a valid hex colour
 * @param {string} color - The string to check
 * @returns {boolean} - True if the string is a valid hex colour
 */
function isValidHexColor(color) {
  // Allow hex codes with or without the # prefix
  if (!color) return false;

  // Remove # if present
  const hex = color.charAt(0) === "#" ? color.substring(1) : color;

  // Check if it's a valid 3 or 6 character hex
  return /^([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex);
}
/**
 * Initialize the palette optimization functionality
 * This adds the necessary UI elements and event listeners
 * and ensures the feature is properly connected to the UI
 */
function initPaletteOptimizer() {
  console.log("Initializing palette optimizer...");

  // Add the optimizer button directly to each background selector
  addOptimizerButtonsDirectly();

  // Initialize the modal for showing optimization results
  createOptimizationModal();

  console.log("Palette optimizer initialization complete");
}

/**
 * Add optimizer buttons directly to each background selector
 * This uses a more direct approach to ensure buttons appear reliably
 */
function addOptimizerButtonsDirectly() {
  // Find all background selectors
  const selectors = document.querySelectorAll(".background-selector");

  console.log(`Found ${selectors.length} background selectors`);

  selectors.forEach((selector) => {
    const section = selector.getAttribute("data-section");
    console.log(`Processing selector for section: ${section}`);

    // Find the background picker - our insertion point
    const backgroundPicker = selector.querySelector(".background-picker");
    if (!backgroundPicker) {
      console.log(`Background picker not found in section: ${section}`);
      return;
    }

    // Check if the button already exists
    if (selector.querySelector(".optimize-palette-button")) {
      console.log(`Optimize button already exists for section: ${section}`);
      return;
    }

    // Create the button
    const optimizeButton = document.createElement("button");
    optimizeButton.className = "optimize-palette-button";
    optimizeButton.textContent = "Optimise all Colours";
    optimizeButton.setAttribute(
      "aria-label",
      "Optimise all colours for contrast"
    );

    // Create a container for proper spacing
    const buttonContainer = document.createElement("div");
    buttonContainer.className = "optimize-button-container";
    buttonContainer.style.margin = "0.5rem 0";
    buttonContainer.appendChild(optimizeButton);

    // Add the button after the background picker
    backgroundPicker.after(buttonContainer);

    // Set initial display state based on the picker visibility
    if (backgroundPicker.style.display !== "none") {
      buttonContainer.style.display = "block";
    } else {
      buttonContainer.style.display = "none";
    }

    // Add click event listener
    optimizeButton.addEventListener("click", function () {
      const backgroundColorPicker = selector.querySelector(
        ".background-colour-picker"
      );
      const targetRadio =
        selector.querySelector(".contrast-target-radio:checked") ||
        selector.querySelector(".contrast-target-radio"); // Fallback to first radio

      if (backgroundColorPicker && targetRadio) {
        const backgroundColor = backgroundColorPicker.value;
        const targetContrast = parseFloat(targetRadio.value || 3); // Default to 3:1

        console.log(
          `Optimizing palette for section: ${section}, background: ${backgroundColor}, target: ${targetContrast}`
        );
        optimizePalette(section, backgroundColor, targetContrast);
      } else {
        console.error("Background color or contrast target not found");
        // Show a friendly error message to the user
        alert("Please select a background colour and contrast target first.");
      }
    });

    // Update visibility when the checkbox state changes
    const checkbox = selector.querySelector(".enable-background-checkbox");
    if (checkbox) {
      checkbox.addEventListener("change", function () {
        buttonContainer.style.display = this.checked ? "block" : "none";
      });
    }

    console.log(`Optimize button added for section: ${section}`);
  });
}

/**
 * Create the modal for displaying optimization results
 * This modal shows before/after comparison and allows selective application of changes
 * Uses the native HTML dialog element for improved accessibility
 */
function createOptimizationModal() {
  // Check if modal already exists
  if (!document.getElementById("optimization-modal")) {
    const modal = document.createElement("dialog");
    modal.id = "optimization-modal";
    modal.className = "optimization-modal";
    modal.setAttribute("aria-labelledby", "optimization-modal-title");

    // Create modal content with improved structure
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
              <option value="balanced">Balanced (contrast vs. similarity)</option>
              <option value="contrast">Maximise contrast</option>
              <option value="similarity" selected>Maximise colour similarity</option>
            </select>

          </div>
          <div class="optimization-actions">
            <form method="dialog">
              <button id="cancel-optimization-button" class="cancel-optimization-button">Cancel</button>
            </form>
                        <button id="reoptimize-button" class="reoptimize-button">Change priority</button>
            <button id="apply-all-button" class="apply-all-button" autofocus>Apply all</button>
          </div>
        </div>
      </div>
    `;

    // Append the modal to the document body
    document.body.appendChild(modal);

    // Add event listeners for modal buttons
    document
      .querySelector(".close-modal-button")
      .addEventListener("click", () => {
        document.body.classList.remove("modal-open");
        modal.close();
      });

    document
      .getElementById("apply-all-button")
      .addEventListener("click", applyAllOptimizations);
    document
      .getElementById("reoptimize-button")
      .addEventListener("click", reoptimizeWithNewSettings);

    // Add event listener for the cancel button
    document
      .getElementById("cancel-optimization-button")
      .addEventListener("click", () => {
        document.body.classList.remove("modal-open");
      });

    // Add event listeners for dialog events
    modal.addEventListener("close", () => {
      document.body.classList.remove("modal-open");
    });

    // When the dialog is opened, add the modal-open class
    modal.addEventListener("showModal", () => {
      document.body.classList.add("modal-open");
    });

    console.log("Optimization modal created with responsive enhancements");
  }
}

/**
 * Optimize the palette for a specific section
 * This analyzes all colours and suggests optimized alternatives
 * @param {string} section - The ID of the section to optimize
 * @param {string} backgroundColor - The background colour to optimize against
 * @param {number} targetContrast - The target contrast ratio
 */
function optimizePalette(section, backgroundColor, targetContrast) {
  console.log(
    `Optimizing palette for section: ${section}, background: ${backgroundColor}, target: ${targetContrast}`
  );

  // Get the table for this section
  let table;
  if (section === "custom") {
    table = document.getElementById("userColorTable");
  } else {
    // Find the table within the section
    const sectionElement = document.getElementById(section);
    if (sectionElement) {
      table = sectionElement.querySelector("table");
    }
  }

  if (!table) {
    console.error(`Table not found for section: ${section}`);
    return;
  }

  // Get all colour rows from the table
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    console.log(`No rows found in table: ${table.id || "unnamed table"}`);
    return;
  }

  // Create an array to store colour data
  const colourData = [];

  // Process each row to get colour data
  rows.forEach((row, index) => {
    // Get the colour from the first cell
    const colorCell = row.querySelector("th");
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
      const priority =
        document.getElementById("optimization-priority")?.value || "similarity";

      // Get an optimized colour
      const optimizationResult = generateOptimizedColor(
        color,
        backgroundColor,
        targetContrast,
        priority
      );
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
      needsChange: contrast < targetContrast,
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
function generateOptimizedColor(
  originalColor,
  backgroundColor,
  targetContrast,
  priority = "similarity"
) {
  // We'll use a similar approach to the existing generateAlternatives function
  // but tailored for specific optimization priorities

  try {
    console.log(
      `Generating optimized color for ${originalColor} against ${backgroundColor} with target contrast ${targetContrast}`
    );
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
      case "contrast":
        // Larger steps, prioritizing reaching contrast target quickly
        stepSizes = [10, 15, 20, 25, 30];
        maxSteps = 30;
        break;
      case "similarity":
        // Smaller steps, prioritizing minimal colour change
        stepSizes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        maxSteps = 40;
        break;
      case "balanced":
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
            if (priority === "similarity") {
              return {
                color: newColor,
                contrast: contrast,
                similarity: similarity,
              };
            }

            // For balanced, find the best similarity that meets contrast
            if (priority === "balanced" && similarity > bestSimilarity) {
              bestColor = newColor;
              bestContrast = contrast;
              bestSimilarity = similarity;
            }

            // For contrast priority, find the highest contrast
            if (priority === "contrast" && contrast > bestContrast) {
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
        similarity: bestSimilarity,
      };
    }

    // If we didn't find a good match with lightness adjustments,
    // try some more aggressive adjustments including saturation
    for (let step = 1; step <= 15; step++) {
      // Adjust lightness
      let newLab = [...originalLab];
      newLab[0] = Math.max(
        0,
        Math.min(100, originalLab[0] + step * 5 * direction)
      );

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

        if (
          contrast >= targetContrast &&
          ((priority === "contrast" && contrast > bestContrast) ||
            (priority === "similarity" && similarity > bestSimilarity) ||
            (priority === "balanced" &&
              contrast * similarity > bestContrast * bestSimilarity))
        ) {
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
          const lightAdj =
            direction > 0
              ? Math.min(1, originalHSL[2] * 1.3)
              : Math.max(0, originalHSL[2] * 0.7);

          const newColor = chroma.hsl(newHue, originalHSL[1], lightAdj).hex();
          const contrast = calculateContrast(newColor, backgroundColor);
          const deltaE = chroma.deltaE(originalColor, newColor);
          const similarity = Math.max(0, 100 - deltaE);

          if (
            contrast >= targetContrast &&
            ((priority === "contrast" && contrast > bestContrast) ||
              (priority === "similarity" && similarity > bestSimilarity) ||
              (priority === "balanced" &&
                contrast * similarity > bestContrast * bestSimilarity))
          ) {
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
        similarity: bestSimilarity,
      };
    }

    // Fallback to a high contrast option if all else fails
    // This is a more radical change but ensures we meet the target
    const fallbackColor = backgroundLuminance > 0.5 ? "#000000" : "#FFFFFF";
    const fallbackContrast = calculateContrast(fallbackColor, backgroundColor);
    const fallbackDeltaE = chroma.deltaE(originalColor, fallbackColor);
    const fallbackSimilarity = Math.max(0, 100 - fallbackDeltaE);

    return {
      color: fallbackColor,
      contrast: fallbackContrast,
      similarity: fallbackSimilarity,
    };
  } catch (e) {
    console.error("Error generating optimized color:", e);
    // Return a safe fallback
    return {
      color: originalColor,
      contrast: calculateContrast(originalColor, backgroundColor),
      similarity: 100,
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

function showOptimizationResults(
  section,
  colourData,
  backgroundColor,
  targetContrast
) {
  // Store the current optimization context for later use
  window.currentOptimization = {
    section: section,
    colourData: colourData,
    backgroundColor: backgroundColor,
    targetContrast: targetContrast,
  };

  // Get the modal element
  const modal = document.getElementById("optimization-modal");
  const summaryElement = document.getElementById("optimization-summary");
  const resultsBody = document.getElementById("optimization-results-body");

  // Clear previous results
  resultsBody.innerHTML = "";

  // Calculate optimization statistics
  const totalColors = colourData.length;
  const initialFailures = colourData.filter(
    (data) => data.originalContrast < targetContrast
  ).length;
  const successfulOptimizations = colourData.filter(
    (data) => data.needsChange && data.newContrast >= targetContrast
  ).length;
  const averageSimilarity =
    colourData
      .filter((data) => data.needsChange)
      .reduce((sum, data) => sum + data.similarity, 0) / (initialFailures || 1);

  // Create the summary with improved formatting - Use formatHexForDisplay for backgroundColor
  summaryElement.innerHTML = `
    <p>Optimizing ${totalColors} colours against background ${formatHexForDisplay(
    backgroundColor
  )} with target contrast ${targetContrast}:1</p>
    <ul>
      <li>${initialFailures} colours initially failed to meet contrast requirements</li>
      <li>${successfulOptimizations} colours were successfully optimized</li>
      <li>Average similarity of optimized colours: ${averageSimilarity.toFixed(
        1
      )}%</li>
    </ul>
  `;

  // Get header texts for data-label attributes
  const headers = [
    "Original Colour",
    "Optimized Colour",
    "Original Contrast",
    "New Contrast",
    "Similarity",
    "Actions",
  ];

  // Create a row for each colour with proper data-labels
  colourData.forEach((data, index) => {
    const row = document.createElement("tr");

    // Original colour cell
    const originalCell = document.createElement("td");
    originalCell.setAttribute("data-label", headers[0]);

    // Create and append color preview span
    const originalPreview = document.createElement("span");
    originalPreview.className = "colour-preview";
    originalPreview.style.backgroundColor = data.originalColor;
    originalCell.appendChild(originalPreview);

    // Create and append color code span - Use formatHexForDisplay
    const originalCode = document.createElement("span");
    originalCode.className = "colour-code";
    originalCode.textContent = formatHexForDisplay(data.originalColor);
    originalCell.appendChild(originalCode);

    row.appendChild(originalCell);

    // Optimized colour cell
    const optimizedCell = document.createElement("td");
    optimizedCell.setAttribute("data-label", headers[1]);

    // Create and append optimized color preview span
    const optimizedPreview = document.createElement("span");
    optimizedPreview.className = "colour-preview";
    optimizedPreview.style.backgroundColor = data.optimizedColor;
    optimizedCell.appendChild(optimizedPreview);

    // Create and append optimized color code span - Use formatHexForDisplay
    const optimizedCode = document.createElement("span");
    optimizedCode.className = "colour-code";
    optimizedCode.textContent = formatHexForDisplay(data.optimizedColor);
    optimizedCell.appendChild(optimizedCode);

    row.appendChild(optimizedCell);

    // Original contrast cell
    const originalContrastCell = document.createElement("td");
    originalContrastCell.setAttribute("data-label", headers[2]);

    const originalContrastClass =
      data.originalContrast >= targetContrast
        ? "contrast-pass"
        : "contrast-fail";

    const originalContrastSpan = document.createElement("span");
    originalContrastSpan.className = originalContrastClass;
    originalContrastSpan.textContent = `${data.originalContrast.toFixed(2)}:1`;
    originalContrastCell.appendChild(originalContrastSpan);

    row.appendChild(originalContrastCell);

    // New contrast cell
    const newContrastCell = document.createElement("td");
    newContrastCell.setAttribute("data-label", headers[3]);

    const newContrastClass =
      data.newContrast >= targetContrast ? "contrast-pass" : "contrast-fail";

    const newContrastSpan = document.createElement("span");
    newContrastSpan.className = newContrastClass;
    newContrastSpan.textContent = `${data.newContrast.toFixed(2)}:1`;
    newContrastCell.appendChild(newContrastSpan);

    row.appendChild(newContrastCell);

    // Similarity cell
    const similarityCell = document.createElement("td");
    similarityCell.setAttribute("data-label", headers[4]);
    similarityCell.textContent = `${data.similarity.toFixed(1)}%`;
    row.appendChild(similarityCell);

    // Actions cell
    const actionsCell = document.createElement("td");
    actionsCell.setAttribute("data-label", headers[5]);

    if (data.needsChange) {
      const applyButton = document.createElement("button");
      applyButton.className = "apply-button";
      applyButton.textContent = "Apply";
      applyButton.setAttribute(
        "aria-label",
        `Apply optimized colour ${formatHexForDisplay(data.optimizedColor)}`
      );
      applyButton.dataset.index = index;
      applyButton.addEventListener("click", function () {
        applySingleOptimization(this.dataset.index);
      });
      actionsCell.appendChild(applyButton);
    } else {
      actionsCell.textContent = "No change needed";
    }

    row.appendChild(actionsCell);

    // Add the row to the table
    resultsBody.appendChild(row);
  });

  // Show the modal
  modal.showModal();

  // Lock scrolling (if the function exists)
  if (typeof lockScroll === "function") {
    lockScroll();
  }

  // Set focus to the "Apply All Changes" button for accessibility
  const applyAllButton = document.getElementById("apply-all-button");
  if (applyAllButton) {
    // Small delay to ensure the modal is visible before focusing
    setTimeout(() => {
      applyAllButton.focus();
    }, 50);
  }
}

/**
 * Apply a single optimization
 * @param {number} index - The index of the colour to optimize
 */
function applySingleOptimization(index) {
  if (!window.currentOptimization) {
    console.error("No active optimization");
    return;
  }

  const { section, colourData, backgroundColor } = window.currentOptimization;
  const data = colourData[index];

  // Only apply if there's a change
  if (data.originalColor !== data.optimizedColor) {
    // Replace the colour in the palette
    replaceColor(data.originalColor, data.optimizedColor);

    // Update the row in the results table to show it's been applied
    const resultsTable = document.getElementById("optimization-results-table");
    const rows = resultsTable.querySelectorAll("tbody tr");

    if (rows[index]) {
      const actionsCell = rows[index].cells[5]; // The actions cell
      actionsCell.innerHTML = "<span>Applied</span>";

      // Update the original colour cell to show the new colour
      const originalCell = rows[index].cells[0];
      originalCell.innerHTML = `
  <span class="colour-preview" style="background-color: ${
    data.optimizedColor
  }"></span>
  <span class="colour-code">${formatHexForDisplay(data.optimizedColor)}</span>
`;

      // Update the original contrast cell
      const originalContrastCell = rows[index].cells[2];
      originalContrastCell.innerHTML = `
                <span class="contrast-pass">${data.newContrast.toFixed(
                  2
                )}:1</span>
            `;

      // Update the data in the colourData array
      colourData[index].originalColor = data.optimizedColor;
      colourData[index].originalContrast = data.newContrast;
      colourData[index].needsChange = false;
    }

    // Update the optimization statistics
    updateOptimizationSummary();
  }
}

/**
 * Apply all optimizations at once
 */
function applyAllOptimizations() {
  if (!window.currentOptimization) {
    console.error("No active optimization");
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
  const modal = document.getElementById("optimization-modal");
  modal.close();
}

/**
 * Re-optimize the palette with new settings
 */
function reoptimizeWithNewSettings() {
  if (!window.currentOptimization) {
    console.error("No active optimization");
    return;
  }

  const { section, backgroundColor, targetContrast } =
    window.currentOptimization;

  // Close the current modal
  const modal = document.getElementById("optimization-modal");
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
  const summaryElement = document.getElementById("optimization-summary");

  // Calculate updated statistics
  const totalColors = colourData.length;
  const remainingFailures = colourData.filter(
    (data) => data.originalContrast < targetContrast
  ).length;
  const appliedChanges = colourData.filter(
    (data) => !data.needsChange && data.originalColor === data.optimizedColor
  ).length;

  // Update the summary
  summaryElement.innerHTML = `
        <p>Optimization progress:</p>
        <ul>
            <li>${remainingFailures} colours still fail to meet contrast requirements</li>
            <li>${appliedChanges} optimizations have been applied</li>
            <li>${
              totalColors - remainingFailures
            } colours now meet contrast requirements</li>
        </ul>
    `;
}

/**
 * Enhances the optimization modal with improved responsive functionality
 * This function updates the optimization modal creation to include proper data-labels
 * for better mobile presentation and responsive behavior
 */
function enhanceOptimizationModal() {
  // Ensure the modal exists
  if (!document.getElementById("optimization-modal")) {
    // This function is meant to enhance an existing modal rather than create one
    console.log(
      "Modal not found, enhancements will be applied to newly created modals"
    );
    return;
  }

  console.log("Enhancing optimization modal for improved responsiveness");

  // Add data-label attributes to existing table cells for responsive display
  const resultsTable = document.getElementById("optimization-results-table");
  if (resultsTable) {
    const headerCells = resultsTable.querySelectorAll("thead th");
    const headerTexts = Array.from(headerCells).map((th) =>
      th.textContent.trim()
    );

    const bodyRows = resultsTable.querySelectorAll("tbody tr");
    bodyRows.forEach((row) => {
      const cells = row.querySelectorAll("td");
      cells.forEach((cell, index) => {
        if (index < headerTexts.length) {
          cell.setAttribute("data-label", headerTexts[index]);
        }
      });
    });

    console.log("Added data-label attributes to table cells");
  }

  // Force redraw of the table container for better scrolling if needed
  const tableContainer = document.querySelector(".table-container");
  if (tableContainer) {
    tableContainer.style.width = "100%";
    console.log("Updated table container for proper scrolling");
  }
}

// Initialization function - call this after the page loads
function initResponsiveOptimizations() {
  // Override the original functions if they exist
  if (typeof window.createOptimizationModal === "function") {
    console.log("Overriding createOptimizationModal with responsive version");
    window.createOptimizationModal = createOptimizationModal;
  }

  if (typeof window.showOptimizationResults === "function") {
    console.log("Overriding showOptimizationResults with responsive version");
    window.showOptimizationResults = showOptimizationResults;
  }

  // Enhance existing modal if it's already on the page
  enhanceOptimizationModal();

  // Add event listener to handle window resize events
  window.addEventListener("resize", function () {
    enhanceOptimizationModal();
  });

  console.log("Responsive optimization enhancements initialized");
}

// Run the initialization on document load
document.addEventListener("DOMContentLoaded", initResponsiveOptimizations);

// Also run immediately if the document is already loaded
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initResponsiveOptimizations();
}

// Initialize on page load
document.addEventListener("DOMContentLoaded", function () {
  initAlternativesModal();
  extendScrollLockToAlternativesModal();
});

// Also run immediately if the document is already loaded
if (
  document.readyState === "interactive" ||
  document.readyState === "complete"
) {
  initAlternativesModal();
  extendScrollLockToAlternativesModal();
}
// Add to the existing window.onload or document.ready function
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the palette optimizer
  initPaletteOptimizer();

  // Also add a delayed initialization as a fallback
  // This helps when the DOM is ready but other scripts are still initializing
  setTimeout(function () {
    // Check if buttons already exist before reinitializing
    const existingButtons = document.querySelectorAll(
      ".optimize-palette-button"
    );
    if (existingButtons.length === 0) {
      console.log("Delayed initialization of palette optimizer...");
      initPaletteOptimizer();
    }
  }, 1000);
});

// Add immediate execution for cases where the DOM is already loaded
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  // Check if buttons already exist before initializing
  const existingButtons = document.querySelectorAll(".optimize-palette-button");
  if (existingButtons.length === 0) {
    console.log("Immediate initialization of palette optimizer...");
    setTimeout(initPaletteOptimizer, 100);
  }
}
/**
 * Simple but effective scroll lock for modals
 * Prevents background scrolling without hiding content
 */

// Store scroll position and scrollbar width
let scrollPosition = 0;
let scrollbarWidth = 0;

/**
 * Calculate scrollbar width once
 * This prevents layout shifts when locking/unlocking scroll
 */
function getScrollbarWidth() {
  // Return cached value if available
  if (scrollbarWidth) return scrollbarWidth;

  // Create a temporary div to measure scrollbar width
  const outer = document.createElement("div");
  outer.style.visibility = "hidden";
  outer.style.overflow = "scroll";
  document.body.appendChild(outer);

  const inner = document.createElement("div");
  outer.appendChild(inner);

  // Calculate the width difference
  scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  // Remove the temporary elements
  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
}

/**
 * Lock scrolling on the body when modal opens
 */
function lockScroll() {
  // Get scrollbar width
  const scrollbarWidth = getScrollbarWidth();

  // Store current scroll position
  scrollPosition = window.pageYOffset || document.documentElement.scrollTop;

  // Add styles to body to prevent scrolling but maintain appearance
  document.body.style.overflow = "hidden";
  document.body.style.position = "relative";
  document.body.style.paddingRight = `${scrollbarWidth}px`;

  console.log("Scroll locked, current position:", scrollPosition);
}

/**
 * Unlock scrolling on the body when modal closes
 */
function unlockScroll() {
  // Remove scroll lock styles
  document.body.style.overflow = "";
  document.body.style.position = "";
  document.body.style.paddingRight = "";

  // Restore scroll position
  window.scrollTo(0, scrollPosition);

  console.log("Scroll unlocked, restored to position:", scrollPosition);
}

/**
 * Initialize scroll lock for optimization modal
 */
function initModalScrollLock() {
  const modal = document.getElementById("optimization-modal");
  if (!modal) {
    console.log("Modal not found, scroll lock not initialized");
    return;
  }

  // Add event listeners for modal open/close
  modal.addEventListener("showModal", function () {
    lockScroll();
  });

  modal.addEventListener("close", function () {
    unlockScroll();
  });

  // Add event listeners for close buttons
  const closeButtons = document.querySelectorAll(
    ".close-modal-button, #cancel-optimization-button"
  );
  closeButtons.forEach((button) => {
    button.addEventListener("click", function () {
      unlockScroll();
      modal.close();
    });
  });

  console.log("Modal scroll lock initialized");
}

// Add to the existing window.onload or document.ready function
document.addEventListener("DOMContentLoaded", function () {
  // Initialize the scroll lock
  initModalScrollLock();

  // Also add a delayed initialization as a fallback
  setTimeout(function () {
    if (document.getElementById("optimization-modal")) {
      initModalScrollLock();
    }
  }, 1000);
});

// Add immediate execution for cases where the DOM is already loaded
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(initModalScrollLock, 100);
}
