// Global variables for background contrast functionality
let currentBackgroundColor = null;
let colorCandidates = null;

// Initialize background finder when DOM is loaded
function initBackgroundFinder() {
  // Add the HTML elements programmatically to avoid modifying the HTML directly
  addBackgroundFinderUI();
  addSaveWithBackgroundButton();
  integrateWithColorSwapping();

  // Add event listeners
  const findBackgroundBtn = document.getElementById("findBackgroundBtn");
  const previewBackgroundToggle = document.getElementById(
    "previewBackgroundToggle"
  );
  const showContrastRatios = document.getElementById("showContrastRatios");

  if (findBackgroundBtn) {
    findBackgroundBtn.addEventListener("click", findContrastingBackgrounds);
  }

  if (previewBackgroundToggle) {
    previewBackgroundToggle.addEventListener("change", function () {
      if (this.checked && currentBackgroundColor) {
        previewBackground(currentBackgroundColor);
      } else {
        clearBackgroundPreview();
      }
    });
  }

  // Initialize contrast ratio display from saved preference
  if (showContrastRatios) {
    // Check for saved preference, but default to true if none exists
    const savedPreference = localStorage.getItem("showContrastRatios");

    // If no preference has been saved yet, or it was explicitly set to true
    const preferenceValue =
      savedPreference === null ? true : savedPreference === "true";

    // Set the checkbox state
    showContrastRatios.checked = preferenceValue;

    // Make sure the UI reflects the initial state
    updateContrastRatioDisplay(preferenceValue);

    showContrastRatios.addEventListener("change", function () {
      updateContrastRatioDisplay(this.checked);
    });
  }

  // Modify the existing save button functionality to include background
  const originalSaveFunction = window.saveSvg;
  if (typeof originalSaveFunction === "function") {
    window.saveSvg = function () {
      saveWithBackground(originalSaveFunction);
    };
  }
}

// Helper function to convert RGB to hex
function rgbToHex(rgb) {
  // Extract the RGB values
  const rgbValues = rgb.match(/\d+/g);
  if (!rgbValues || rgbValues.length !== 3) return "";

  // Convert to hex
  const hex =
    "#" +
    rgbValues
      .map((x) => {
        const hex = parseInt(x).toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      })
      .join("")
      .toUpperCase();

  return hex;
}

// Add a new helper function to ensure consistent display of colour codes
function displayColourCode(colour) {
  if (!colour) return "";
  // Use the existing normalizeColour function and ensure it's uppercase
  try {
    return normalizeColour(colour).toUpperCase();
  } catch (e) {
    console.error("Error formatting colour code:", e);
    // Fall back to direct uppercase if normalization fails
    return typeof colour === "string" ? colour.toUpperCase() : colour;
  }
}

// Add new helper function
function addSaveWithBackgroundButton() {
  // Add button after the existing save button
  const saveBtn = document.getElementById("saveBtn");
  if (saveBtn) {
    const saveWithBgBtn = document.createElement("button");
    saveWithBgBtn.id = "saveWithBgBtn";
    saveWithBgBtn.className = "SVGCVDButton";
    saveWithBgBtn.textContent = "Save SVG with Background";
    saveWithBgBtn.style.display = "none";
    saveWithBgBtn.disabled = true;

    // Add click handler
    saveWithBgBtn.addEventListener("click", saveSvgWithBackground);

    // Insert after save button
    saveBtn.insertAdjacentElement("afterend", saveWithBgBtn);
  }
}

// Add the background finder UI to the page
function addBackgroundFinderUI() {
  // Create the background finder section
  const backgroundSection = document.createElement("div");
  backgroundSection.id = "backgroundFinderSection";
  backgroundSection.className = "tool-section";

  // Initially hide the background finder section
  backgroundSection.style.display = "none";

  // Add content to the section - Fixed to 3:1 contrast ratio
  backgroundSection.innerHTML = `
        <h2 class="CVDTool">Find Contrasting Background</h2>
        <p>Find background colours with at least 3:1 contrast ratio (WCAG AA for UI components)</p>
        <button id="findBackgroundBtn" class="SVGCVDButton">Find Background Colours</button>
        <div id="backgroundResults"></div>
        <div id="backgroundPreviewControls" class="preview-controls" style="display: none;">
            <label for="previewBackgroundToggle">Preview Background:</label>
            <input type="checkbox" id="previewBackgroundToggle">
            <div id="backgroundPreviewSwatch" class="preview-swatch"></div>
            
            <span class="control-separator"></span>
            
            <label for="showContrastRatios">Show Contrast Ratios:</label>
            <input type="checkbox" id="showContrastRatios">
        </div>
    `;

  // Check if paletteSelection exists
  const paletteSelection = document.getElementById("paletteSelection");

  if (paletteSelection) {
    // Create a wrapper container for side-by-side layout
    const toolsContainer = document.createElement("div");
    toolsContainer.id = "toolsContainer";
    toolsContainer.className = "tools-container";

    // Insert the wrapper before paletteSelection
    paletteSelection.parentNode.insertBefore(toolsContainer, paletteSelection);

    // Move paletteSelection into the wrapper FIRST, then add backgroundSection
    // This reverses the order compared to the previous implementation
    toolsContainer.appendChild(paletteSelection);
    toolsContainer.appendChild(backgroundSection);

    // Add the CSS for the side-by-side layout
    addSideBySideLayoutStyles();
  } else {
    // Fallback: append to colorInfo
    const colorInfo = document.getElementById("colorInfo");
    if (colorInfo) {
      colorInfo.appendChild(backgroundSection);
    }
  }

  // Add integration with the existing file upload process
  integrateWithFileUpload();
}
// Integrate with the existing file upload functionality
function integrateWithFileUpload() {
  // Get the file input element
  const fileInput = document.getElementById("fileInput");

  if (fileInput) {
    // Store the original event handlers
    const originalHandlers = [...(fileInput._events || [])];

    // Remove existing event handler to avoid duplication
    if (fileInput._events) {
      fileInput.removeEventListener("change", fileInput._events[0]);
    }

    // Add our new handler that ONLY shows the background finder (doesn't call handleFileUpload again)
    fileInput.addEventListener("change", function (event) {
      // Show the background finder section when an SVG is loaded
      const file = event.target.files[0];
      if (file && file.type === "image/svg+xml") {
        // REMOVED: Don't call handleFileUpload again
        // if (typeof handleFileUpload === "function") {
        //     handleFileUpload(event);
        // }

        // Now show the background finder section after a short delay
        // to ensure the SVG is processed by the original handler
        setTimeout(() => {
          const backgroundSection = document.getElementById(
            "backgroundFinderSection"
          );
          if (backgroundSection) {
            backgroundSection.style.display = "block";
          }
        }, 500);
      }
    });

    // Store the new handler
    fileInput._events = [fileInput.onchange];
  }

  // Also hook into the existing reset functionality
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    const originalResetClick = resetBtn.onclick;

    resetBtn.onclick = function (event) {
      // Call the original handler
      if (originalResetClick) {
        originalResetClick.call(this, event);
      }

      // Make sure the background finder is shown (in case it was hidden)
      const backgroundSection = document.getElementById(
        "backgroundFinderSection"
      );
      if (backgroundSection) {
        backgroundSection.style.display = "block";
      }
    };
  }
}

// Add CSS for side-by-side layout
function addSideBySideLayoutStyles() {
  const style = document.createElement("style");
  style.textContent = `
    /* Button swatch styles - ADDED FOR COLOUR SWATCH ENHANCEMENT */
    .button-swatch {
      display: inline-block;
      width: 16px;
      height: 16px;
      border-radius: 3px;
      border: 1px solid rgba(0, 0, 0, 0.2);
      vertical-align: middle;
      margin: 0 4px;
    }

    /* Make the apply button easier to read with swatches - ADDED FOR COLOUR SWATCH ENHANCEMENT */
    .apply-single-btn {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 5px;
      line-height: 1.5;
      padding: 8px 12px;
    }
  `;
  document.head.appendChild(style);
}
// Extract current colors from SVG after any swaps
function extractCurrentSvgColors() {
  const parser = new DOMParser();
  const svgContent = document.getElementById("container1").innerHTML;
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const elements = svgDoc.querySelectorAll("*");
  const uniqueColors = new Set();

  elements.forEach((el) => {
    const fill = el.getAttribute("fill");
    const stroke = el.getAttribute("stroke");
    if (fill && fill !== "none") uniqueColors.add(normalizeColour(fill));
    if (stroke && stroke !== "none") uniqueColors.add(normalizeColour(stroke));
  });

  return Array.from(uniqueColors);
}

// Normalize colour to standard hex format
function normalizeColour(colour) {
  // Skip normalization for 'none' values
  if (colour === "none") {
    return colour;
  }

  try {
    return chroma(colour).hex().toUpperCase();
  } catch (e) {
    console.error("Error normalizing colour:", e);
    return colour;
  }
}

// Calculate contrast ratio between two colors
function getContrast(color1, color2) {
  try {
    return chroma.contrast(color1, color2);
  } catch (e) {
    console.error("Error calculating contrast:", e);
    return 0;
  }
}

// Helper function to determine appropriate text color
function getContrastTextColor(backgroundColor) {
  try {
    return chroma(backgroundColor).luminance() > 0.5 ? "#000" : "#fff";
  } catch (e) {
    console.error("Error determining text color:", e);
    return "#000";
  }
}
// Find background colors with sufficient contrast
function findContrastingBackgrounds() {
  // Check if chroma.js is loaded
  if (typeof chroma === "undefined") {
    loadChromaJs(() => findContrastingBackgrounds());
    return;
  }

  // Get current colors from the SVG
  const currentColors = extractCurrentSvgColors();

  if (currentColors.length === 0) {
    displayNotification(
      "No colours found in the SVG. Please load an SVG file first.",
      "error"
    );
    return;
  }

  // Show loading message
  displayNotification("Finding contrasting background colours...", "info");

  // Set fixed target contrast to 3:1
  const targetContrast = 3;

  // Generate color candidates if not already done
  if (!colorCandidates) {
    colorCandidates = generateColourCandidates();
  }

  // Find matches
  const results = findMatchingColours(currentColors, targetContrast);

  // Display results
  displayBackgroundResults(results, currentColors, targetContrast);
}

// Load chroma.js dynamically if not already loaded
function loadChromaJs(callback) {
  displayNotification("Loading colour calculation library...", "info");

  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/chroma-js@2.4.2/chroma.min.js";
  script.onload = function () {
    displayNotification("Colour calculation library loaded.", "success");
    if (typeof callback === "function") {
      callback();
    }
  };
  script.onerror = function () {
    displayNotification(
      "Failed to load colour calculation library. Please check your internet connection and try again.",
      "error"
    );
  };

  document.head.appendChild(script);
}

// Generate a range of color candidates to test
function generateColourCandidates() {
  const candidates = [];

  // Generate off-white to off-black scale (grays)
  // Changed from 0-100 to 3-97 to avoid pure black and white
  for (let i = 3; i <= 97; i += 5) {
    candidates.push(chroma.hsl(0, 0, i / 100).hex());
  }

  // Explicitly add slightly off-black and off-white alternatives
  candidates.push("#0d0d0d"); // Slightly off-black
  candidates.push("#f5f5f5"); // Slightly off-white

  // Generate hues at different saturations and lightnesses
  for (let h = 0; h < 360; h += 20) {
    // More hue variations for better coverage
    for (let s = 0.3; s <= 1; s += 0.3) {
      for (let l = 0.2; l <= 0.8; l += 0.2) {
        candidates.push(chroma.hsl(h, s, l).hex());
      }
    }
  }

  return candidates;
}

// Find colors that meet the target contrast ratio
function findMatchingColours(inputColors, targetContrast) {
  const fullMatches = []; // Colors that have sufficient contrast with all input colors
  let partialMatches = {}; // Colors that have sufficient contrast with some input colors
  let bestPartialSize = 0; // The maximum number of input colors a partial match works with

  colorCandidates.forEach((candidate) => {
    let passingColors = [];
    let failingColors = [];

    inputColors.forEach((inputColor) => {
      const contrastRatio = getContrast(candidate, inputColor);
      if (contrastRatio >= targetContrast) {
        passingColors.push(inputColor);
      } else {
        failingColors.push(inputColor);
      }
    });

    if (passingColors.length === inputColors.length) {
      fullMatches.push(candidate);
    } else if (passingColors.length > 0) {
      if (passingColors.length > bestPartialSize) {
        bestPartialSize = passingColors.length;
      }

      if (!partialMatches[passingColors.length]) {
        partialMatches[passingColors.length] = [];
      }

      // Store which colors pass and fail for this candidate
      partialMatches[passingColors.length].push({
        color: candidate,
        passingColors: passingColors,
        failingColors: failingColors,
      });
    }
  });

  return {
    fullMatches,
    partialMatches,
    bestPartialSize,
  };
}

// Determine which color category a color belongs to
function determineColourGroup(colour) {
  try {
    const hsl = chroma(colour).hsl();
    const h = hsl[0] || 0; // hue
    const s = hsl[1]; // saturation
    const l = hsl[2]; // lightness

    // Handle grayscale colors
    if (s < 0.1) {
      if (l > 0.9) return "whites";
      if (l < 0.2) return "blacks";
      return "greys";
    }

    // Determine hue category
    if (h >= 0 && h < 30) return "reds";
    if (h >= 30 && h < 60) return "oranges";
    if (h >= 60 && h < 90) return "yellows";
    if (h >= 90 && h < 150) return "greens";
    if (h >= 150 && h < 210) return "cyans";
    if (h >= 210 && h < 270) return "blues";
    if (h >= 270 && h < 330) return "purples";
    return "pinks"; // 330-360
  } catch (e) {
    console.error("Error determining color group:", e);
    return "other";
  }
}

// Group matching colors by category
function groupMatchingColours(matches) {
  const groups = {
    whites: [],
    greys: [],
    blacks: [],
    reds: [],
    oranges: [],
    yellows: [],
    greens: [],
    cyans: [],
    blues: [],
    purples: [],
    pinks: [],
    other: [],
  };

  matches.forEach((color) => {
    const group = determineColourGroup(color);
    groups[group].push(color);
  });

  return groups;
}

// Get display name for color group
function getGroupDisplayName(group) {
  const displayNames = {
    whites: "Whites & Off-whites",
    greys: "Greys",
    blacks: "Blacks & Off-blacks",
    reds: "Reds",
    oranges: "Oranges & Browns",
    yellows: "Yellows",
    greens: "Greens",
    cyans: "Cyans",
    blues: "Blues",
    purples: "Purples",
    pinks: "Pinks & Magentas",
    other: "Other Colours",
  };

  return displayNames[group] || group;
}
// Display background color results
function displayBackgroundResults(results, inputColors, targetContrast) {
  const { fullMatches, partialMatches, bestPartialSize } = results;
  const backgroundResults = document.getElementById("backgroundResults");

  backgroundResults.innerHTML = "";

  if (fullMatches.length > 0) {
    const groupedMatches = groupMatchingColours(fullMatches);
    displayGroupedMatches(groupedMatches, inputColors, backgroundResults);
    displayNotification(
      `Found ${fullMatches.length} background colours with at least ${targetContrast}:1 contrast ratio with all SVG colours.`,
      "success"
    );
  } else if (bestPartialSize > 0) {
    const bestMatches = partialMatches[bestPartialSize] || [];
    displayPartialMatches(
      bestMatches,
      inputColors,
      bestPartialSize,
      backgroundResults
    );
    displayNotification(
      `Found ${bestMatches.length} background colours with at least ${targetContrast}:1 contrast ratio with ${bestPartialSize} out of ${inputColors.length} SVG colours.`,
      "info"
    );
  } else {
    backgroundResults.innerHTML =
      "<p>No background colours found that meet the contrast requirement. Try reducing the target contrast ratio.</p>";
    displayNotification(
      "No suitable background colours found. Try lowering the contrast ratio requirement.",
      "error"
    );
  }

  // Show the background finder section
  document.getElementById("backgroundFinderSection").style.display = "block";

  // Apply contrast ratios display based on user preference
  const showContrastRatios = document.getElementById("showContrastRatios");
  if (showContrastRatios && showContrastRatios.checked) {
    updateContrastRatioDisplay(true);
  }
}

// Display grouped matches
function displayGroupedMatches(groupedMatches, inputColors, container) {
  const groups = Object.keys(groupedMatches).filter(
    (group) => groupedMatches[group].length > 0
  );

  if (groups.length === 0) {
    container.innerHTML = "<p>No matching background colours found.</p>";
    return;
  }

  // Create a table of contents for color groups
  const toc = document.createElement("div");
  toc.className = "color-group-toc";
  toc.innerHTML = "<h3>Colour Categories:</h3><ul></ul>";

  const totalColors = groups.reduce(
    (acc, group) => acc + groupedMatches[group].length,
    0
  );

  groups.forEach((group) => {
    const count = groupedMatches[group].length;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#group-${group}`;
    a.textContent = `${getGroupDisplayName(group)} (${count})`;
    li.appendChild(a);
    toc.querySelector("ul").appendChild(li);
  });

  container.appendChild(toc);

  // Create each color group section
  groups.forEach((group) => {
    const groupSection = document.createElement("div");
    groupSection.className = "color-group";
    groupSection.id = `group-${group}`;

    const heading = document.createElement("h3");
    heading.textContent = getGroupDisplayName(group);
    groupSection.appendChild(heading);

    const colorGrid = document.createElement("div");
    colorGrid.className = "color-grid";

    // Add heading for accessibility
    const gridHeading = document.createElement("h4");
    gridHeading.className = "color-grid-heading"; // Optional class for styling
    gridHeading.textContent = "Choose a background colour";
    groupSection.appendChild(gridHeading);
    groupSection.appendChild(colorGrid);

    // Sort colors by contrast (highest first)
    const sortedColors = [...groupedMatches[group]].sort((a, b) => {
      const minContrastA = Math.min(
        ...inputColors.map((color) => getContrast(a, color))
      );
      const minContrastB = Math.min(
        ...inputColors.map((color) => getContrast(b, color))
      );
      return minContrastB - minContrastA;
    });

    // Limit to 12 colors per group to avoid overwhelming the user
    const limitedColors = sortedColors.slice(0, 12);

    limitedColors.forEach((color) => {
      const colorCard = createColorCard(color, inputColors);
      colorGrid.appendChild(colorCard);
    });

    // Show a "show more" button if there are more colors
    if (sortedColors.length > 12) {
      const showMoreBtn = document.createElement("button");
      showMoreBtn.className = "SVGCVDButton show-more-btn";
      showMoreBtn.textContent = `Show ${
        sortedColors.length - 12
      } more ${getGroupDisplayName(group)}`;
      showMoreBtn.addEventListener("click", () => {
        // Remove the button
        colorGrid.removeChild(showMoreBtn);

        // Add the remaining colors
        sortedColors.slice(12).forEach((color) => {
          const colorCard = createColorCard(color, inputColors);
          colorGrid.appendChild(colorCard);
        });

        // Apply contrast ratios if needed
        const showContrastRatios =
          document.getElementById("showContrastRatios");
        if (showContrastRatios && showContrastRatios.checked) {
          updateContrastRatioDisplay(true);
        }
      });

      colorGrid.appendChild(showMoreBtn);
    }

    groupSection.appendChild(colorGrid);
    container.appendChild(groupSection);
  });
}
// Display background color results
function displayBackgroundResults(results, inputColors, targetContrast) {
  const { fullMatches, partialMatches, bestPartialSize } = results;
  const backgroundResults = document.getElementById("backgroundResults");

  backgroundResults.innerHTML = "";

  if (fullMatches.length > 0) {
    const groupedMatches = groupMatchingColours(fullMatches);
    displayGroupedMatches(groupedMatches, inputColors, backgroundResults);
    displayNotification(
      `Found ${fullMatches.length} background colours with at least ${targetContrast}:1 contrast ratio with all SVG colours.`,
      "success"
    );
  } else if (bestPartialSize > 0) {
    const bestMatches = partialMatches[bestPartialSize] || [];
    displayPartialMatches(
      bestMatches,
      inputColors,
      bestPartialSize,
      backgroundResults
    );
    displayNotification(
      `Found ${bestMatches.length} background colours with at least ${targetContrast}:1 contrast ratio with ${bestPartialSize} out of ${inputColors.length} SVG colours.`,
      "info"
    );
  } else {
    backgroundResults.innerHTML =
      "<p>No background colours found that meet the contrast requirement. Try reducing the target contrast ratio.</p>";
    displayNotification(
      "No suitable background colours found. Try lowering the contrast ratio requirement.",
      "error"
    );
  }

  // Show the background finder section
  document.getElementById("backgroundFinderSection").style.display = "block";

  // Apply contrast ratios display based on user preference
  const showContrastRatios = document.getElementById("showContrastRatios");
  if (showContrastRatios && showContrastRatios.checked) {
    updateContrastRatioDisplay(true);
  }
}

// Display grouped matches
function displayGroupedMatches(groupedMatches, inputColors, container) {
  const groups = Object.keys(groupedMatches).filter(
    (group) => groupedMatches[group].length > 0
  );

  if (groups.length === 0) {
    container.innerHTML = "<p>No matching background colours found.</p>";
    return;
  }

  // Create a table of contents for color groups
  const toc = document.createElement("div");
  toc.className = "color-group-toc";
  toc.innerHTML = '<h3 class="CVDTool">Colour Categories:</h3><ul></ul>';

  const totalColors = groups.reduce(
    (acc, group) => acc + groupedMatches[group].length,
    0
  );

  groups.forEach((group) => {
    const count = groupedMatches[group].length;
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = `#group-${group}`;
    a.textContent = `${getGroupDisplayName(group)} (${count})`;
    li.appendChild(a);
    toc.querySelector("ul").appendChild(li);
  });

  container.appendChild(toc);

  // Create each color group section
  groups.forEach((group) => {
    const groupSection = document.createElement("div");
    groupSection.className = "color-group";
    groupSection.id = `group-${group}`;

    const heading = document.createElement("h4");
    heading.className = "CVDTool";
    heading.textContent = getGroupDisplayName(group);
    groupSection.appendChild(heading);

    const colorGrid = document.createElement("div");
    colorGrid.className = "color-grid";

    // Sort colors by contrast (highest first)
    const sortedColors = [...groupedMatches[group]].sort((a, b) => {
      const minContrastA = Math.min(
        ...inputColors.map((color) => getContrast(a, color))
      );
      const minContrastB = Math.min(
        ...inputColors.map((color) => getContrast(b, color))
      );
      return minContrastB - minContrastA;
    });

    // Limit to 12 colors per group to avoid overwhelming the user
    const limitedColors = sortedColors.slice(0, 12);

    limitedColors.forEach((color) => {
      const colorCard = createColorCard(color, inputColors);
      colorGrid.appendChild(colorCard);
    });

    // Show a "show more" button if there are more colors
    if (sortedColors.length > 12) {
      const showMoreBtn = document.createElement("button");
      showMoreBtn.className = "SVGCVDButton show-more-btn";
      showMoreBtn.textContent = `Show ${
        sortedColors.length - 12
      } more ${getGroupDisplayName(group)}`;
      showMoreBtn.addEventListener("click", () => {
        // Remove the button
        colorGrid.removeChild(showMoreBtn);

        // Add the remaining colors
        sortedColors.slice(12).forEach((color) => {
          const colorCard = createColorCard(color, inputColors);
          colorGrid.appendChild(colorCard);
        });

        // Apply contrast ratios if needed
        const showContrastRatios =
          document.getElementById("showContrastRatios");
        if (showContrastRatios && showContrastRatios.checked) {
          updateContrastRatioDisplay(true);
        }
      });

      colorGrid.appendChild(showMoreBtn);
    }

    groupSection.appendChild(colorGrid);
    container.appendChild(groupSection);
  });
}

function displayPartialMatches(
  partialMatches,
  inputColors,
  matchSize,
  container
) {
  container.innerHTML = `
      <div class="partial-match-info">
          <button type="button" class="close-info-btn" aria-label="Close information message">
              <span aria-hidden="true">×</span>
          </button>
          <p>No background colours found with sufficient contrast for all SVG colours.</p>
          <p>Showing colours that work with ${matchSize} out of ${inputColors.length} SVG colours.</p>
      </div>
  `;

  // Add event listener for the close button
  const closeButton = container.querySelector(".close-info-btn");
  if (closeButton) {
    closeButton.addEventListener("click", function () {
      const infoBox = this.closest(".partial-match-info");
      if (infoBox) {
        infoBox.style.display = "none";
      }
    });

    // Add keyboard handling for accessibility
    closeButton.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.click();
      }
    });
  }

  // Add the "Fix automatically" button FIRST
  const fixAutoBtn = document.createElement("button");
  fixAutoBtn.className = "SVGCVDButton apply-all-btn";
  fixAutoBtn.textContent = "Try to resolve automatically";
  fixAutoBtn.setAttribute(
    "aria-label",
    "Automatically apply suggested replacements for problematic colours"
  );

  // Add event listener for the automatic fix
  fixAutoBtn.addEventListener("click", () => {
    // Check if a background color is selected
    if (currentBackgroundColor) {
      // Find the partial match that corresponds to the currently selected background color
      const selectedMatch = partialMatches.find(
        (match) =>
          normalizeColour(match.color) ===
          normalizeColour(currentBackgroundColor)
      );

      // If we found a matching background, use it; otherwise fall back to the first one
      if (selectedMatch) {
        generateAndApplyAutoFixes(selectedMatch, inputColors);
      } else {
        // If we couldn't find the selected color in our matches, use the first one
        // and inform the user with a notification
        displayNotification(
          "Couldn't find the selected background colour in the matches. Using the first match instead.",
          "info"
        );
        generateAndApplyAutoFixes(partialMatches[0], inputColors);
      }
    } else {
      // If no background is selected, use the first one
      generateAndApplyAutoFixes(partialMatches[0], inputColors);
    }
  });

  container.appendChild(fixAutoBtn);

  // RENAMED: Change the "Suggest Accessible Colour Alternatives" button
  const chooseAltBtn = document.createElement("button");
  chooseAltBtn.className = "SVGCVDButton";
  chooseAltBtn.textContent = "Choose alternative colours";
  chooseAltBtn.setAttribute(
    "aria-label",
    "Choose accessible colour alternatives for problematic SVG colours"
  );

  // Modified event listener to use the currently selected background color
  chooseAltBtn.addEventListener("click", () => {
    // If no background color is selected, use the first one by default
    if (!currentBackgroundColor) {
      suggestAccessibleAlternatives(partialMatches[0], inputColors);
      return;
    }

    // Find the partial match that corresponds to the currently selected background color
    const selectedMatch = partialMatches.find(
      (match) =>
        normalizeColour(match.color) === normalizeColour(currentBackgroundColor)
    );

    // If we found a matching background, use it; otherwise fall back to the first one
    if (selectedMatch) {
      suggestAccessibleAlternatives(selectedMatch, inputColors);
    } else {
      // If we couldn't find the selected color in our matches, use the first one
      // and inform the user with a notification
      displayNotification(
        "Couldn't find the selected background colour in the matches. Using the first match instead.",
        "info"
      );
      suggestAccessibleAlternatives(partialMatches[0], inputColors);
    }
  });

  container.appendChild(chooseAltBtn);

  const colorGrid = document.createElement("div");
  colorGrid.className = "color-grid";

  // Add heading for accessibility
  const gridHeading = document.createElement("h4");
  gridHeading.className = "color-grid-heading CVDTool";
  gridHeading.textContent = "Choose a background colour";
  container.appendChild(gridHeading);
  container.appendChild(colorGrid);

  // Sort by number of failing colors (fewer is better)
  const sortedMatches = [...partialMatches].sort((a, b) => {
    return a.failingColors.length - b.failingColors.length;
  });

  // Limit to 20 colors to avoid overwhelming the user
  const limitedMatches = sortedMatches.slice(0, 20);

  limitedMatches.forEach((match) => {
    const colorCard = createPartialMatchCard(match, inputColors);
    colorGrid.appendChild(colorCard);
  });

  container.appendChild(colorGrid);
}

// Helper function to generate and apply automatic fixes
function generateAndApplyAutoFixes(bestMatch, inputColors) {
  const { color: backgroundColor, failingColors } = bestMatch;

  // Show loading message
  displayNotification("Automatically fixing colour contrast issues...", "info");

  // Object to store all replacements
  const replacements = {};

  // Process each problematic color
  const processingPromises = failingColors.map((originalColor) => {
    return new Promise((resolve) => {
      // Generate alternatives
      generateAccessibleAlternatives(
        originalColor,
        backgroundColor,
        3, // Target contrast ratio
        (alternativeColors) => {
          // Use the first (most similar) alternative
          if (alternativeColors.length > 0) {
            replacements[originalColor] = alternativeColors[0].color;
          }
          resolve();
        }
      );
    });
  });

  // When all alternatives are generated, apply them
  Promise.all(processingPromises).then(() => {
    applyColorReplacements(replacements, backgroundColor);
  });
}

// Add a new helper function to visually mark the selected background color
function markSelectedBackgroundColor() {
  // First, remove the selected class from all color cards
  const allCards = document.querySelectorAll(".color-card");
  allCards.forEach((card) => {
    card.classList.remove("selected-background");
  });

  // If we have a selected background color, find and mark its card
  if (currentBackgroundColor) {
    allCards.forEach((card) => {
      // Get the color value from the card
      const colorValueEl = card.querySelector(".color-value");
      if (
        colorValueEl &&
        normalizeColour(colorValueEl.textContent) ===
          normalizeColour(currentBackgroundColor)
      ) {
        card.classList.add("selected-background");
      }
    });
  }
}
// Create a color card for full matches
function createColorCard(color, inputColors) {
  const card = document.createElement("div");
  card.className = "color-card";
  card.style.backgroundColor = color;

  const colorValue = document.createElement("div");
  colorValue.className = "color-value";
  colorValue.textContent = displayColourCode(color); // Use the display function

  // Set text color for readability
  const textColor = getContrastTextColor(color);
  colorValue.style.color = textColor;

  const contrastInfo = document.createElement("div");
  contrastInfo.className = "contrast-info";

  const minContrast = Math.min(
    ...inputColors.map((inputColor) => getContrast(color, inputColor))
  );
  const minContrastDisplay = minContrast.toFixed(2);

  const contrastText = document.createElement("span");
  contrastText.textContent = `Min Contrast: ${minContrastDisplay}:1`;
  contrastText.style.color = textColor;
  contrastInfo.appendChild(contrastText);

  // Add preview button - WITHOUT inline color/border styles
  const previewBtn = document.createElement("button");
  previewBtn.className = "preview-btn";
  previewBtn.textContent = "Preview";
  previewBtn.setAttribute("aria-label", `Preview background colour ${color}`);

  previewBtn.addEventListener("click", () => {
    setBackgroundPreview(color);
  });

  // Add keyboard handling for accessibility
  previewBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setBackgroundPreview(color);
    }
  });

  card.appendChild(colorValue);
  card.appendChild(contrastInfo);
  card.appendChild(previewBtn);

  return card;
}

// Create a color card for partial matches
function createPartialMatchCard(match, inputColors) {
  const { color, passingColors, failingColors } = match;
  const card = document.createElement("div");
  card.className = "color-card";
  card.style.backgroundColor = color;

  const colorValue = document.createElement("div");
  colorValue.className = "color-value";
  colorValue.textContent = displayColourCode(color); // Use the display function

  // Set text color for readability
  const textColor = getContrastTextColor(color);
  colorValue.style.color = textColor;

  // Passing colors section with swatches
  const passingSection = document.createElement("div");
  passingSection.className = "color-result-section";

  const passingLabel = document.createElement("div");
  passingLabel.className = "color-result-label";
  passingLabel.style.color = textColor;
  passingLabel.textContent = `Passes (${passingColors.length}):`;
  passingSection.appendChild(passingLabel);

  const passingSwatches = document.createElement("div");
  passingSwatches.className = "color-swatches";

  // Get the show contrast ratios preference
  const showRatios = localStorage.getItem("showContrastRatios") === "true";

  // Create swatches with contrast ratios if needed
  passingColors.forEach((passColor) => {
    const contrastRatio = getContrast(passColor, color).toFixed(2);

    if (showRatios) {
      const swatchContainer = document.createElement("div");
      swatchContainer.className = "swatch-with-ratio";

      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = passColor;
      swatch.title = `${passColor} (${contrastRatio}:1)`;
      swatch.setAttribute(
        "aria-label",
        `Passing colour ${passColor} with contrast ratio ${contrastRatio}:1`
      );

      const ratioText = document.createElement("span");
      ratioText.className = "contrast-ratio";
      ratioText.textContent = `${contrastRatio}:1`;
      // Set color for readability
      ratioText.style.color = textColor;

      swatchContainer.appendChild(swatch);
      swatchContainer.appendChild(ratioText);
      passingSwatches.appendChild(swatchContainer);
    } else {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = passColor;
      swatch.title = `${passColor} (${contrastRatio}:1)`;
      swatch.setAttribute(
        "aria-label",
        `Passing colour ${passColor} with contrast ratio ${contrastRatio}:1`
      );
      passingSwatches.appendChild(swatch);
    }
  });

  passingSection.appendChild(passingSwatches);

  // Failing colors section with swatches
  const failingSection = document.createElement("div");
  failingSection.className = "color-result-section";

  const failingLabel = document.createElement("div");
  failingLabel.className = "color-result-label";
  failingLabel.style.color = textColor;
  failingLabel.textContent = `Fails (${failingColors.length}):`;
  failingSection.appendChild(failingLabel);

  const failingSwatches = document.createElement("div");
  failingSwatches.className = "color-swatches";

  // Similar treatment for failing colors
  failingColors.forEach((failColor) => {
    const contrastRatio = getContrast(failColor, color).toFixed(2);

    if (showRatios) {
      const swatchContainer = document.createElement("div");
      swatchContainer.className = "swatch-with-ratio";

      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = failColor;
      swatch.title = `${failColor} (${contrastRatio}:1)`;
      swatch.setAttribute(
        "aria-label",
        `Failing colour ${failColor} with contrast ratio ${contrastRatio}:1`
      );

      const ratioText = document.createElement("span");
      ratioText.className = "contrast-ratio";
      ratioText.textContent = `${contrastRatio}:1`;
      // Set color for readability
      ratioText.style.color = textColor;

      swatchContainer.appendChild(swatch);
      swatchContainer.appendChild(ratioText);
      failingSwatches.appendChild(swatchContainer);
    } else {
      const swatch = document.createElement("div");
      swatch.className = "color-swatch";
      swatch.style.backgroundColor = failColor;
      swatch.title = `${failColor} (${contrastRatio}:1)`;
      swatch.setAttribute(
        "aria-label",
        `Failing colour ${failColor} with contrast ratio ${contrastRatio}:1`
      );
      failingSwatches.appendChild(swatch);
    }
  });

  failingSection.appendChild(failingSwatches);

  // Add preview button - WITHOUT inline color/border styles
  const previewBtn = document.createElement("button");
  previewBtn.className = "preview-btn";
  previewBtn.textContent = "Preview";
  previewBtn.setAttribute(
    "aria-label",
    `Preview partial match background colour ${color}`
  );

  previewBtn.addEventListener("click", () => {
    setBackgroundPreview(color);
  });

  // Add keyboard handling for accessibility
  previewBtn.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setBackgroundPreview(color);
    }
  });

  card.appendChild(colorValue);
  card.appendChild(passingSection);
  card.appendChild(failingSection);
  card.appendChild(previewBtn);

  return card;
}
// Update contrast ratio display based on user preference
function updateContrastRatioDisplay(showRatios) {
  // Store the preference
  localStorage.setItem("showContrastRatios", showRatios);

  // Get all color swatches in the results
  const swatches = document.querySelectorAll(".color-swatches .color-swatch");

  swatches.forEach((swatch) => {
    // Get the parent container (could be swatch-with-ratio or color-swatches)
    const container =
      swatch.closest(".swatch-with-ratio") || swatch.parentElement;

    // If we're in a color-swatches container but not in a swatch-with-ratio
    if (
      !swatch.closest(".swatch-with-ratio") &&
      container &&
      container.classList.contains("color-swatches")
    ) {
      if (showRatios) {
        // We need to add the contrast ratio
        // First, get the color values
        const backgroundColor = currentBackgroundColor || "#FFFFFF";
        const swatchColor = swatch.style.backgroundColor;
        const swatchTitle = swatch.title;
        let colorValue = "";

        // Try to extract the color value from the title (format: "#RRGGBB (x.xx:1)")
        if (swatchTitle && swatchTitle.includes(" ")) {
          colorValue = swatchTitle.split(" ")[0];
        }

        // Calculate contrast ratio
        const contrastRatio = getContrast(swatchColor, backgroundColor).toFixed(
          2
        );

        // Create wrapper and ratio element
        const wrapper = document.createElement("div");
        wrapper.className = "swatch-with-ratio";

        const ratioElement = document.createElement("span");
        ratioElement.className = "contrast-ratio";
        ratioElement.textContent = `${contrastRatio}:1`;

        // Determine text color based on the card background color
        const card = swatch.closest(".color-card");
        if (card) {
          const cardColor = card.style.backgroundColor;
          const textColor = getContrastTextColor(cardColor);
          ratioElement.style.color = textColor;
        }

        // Replace the swatch with our wrapper
        container.insertBefore(wrapper, swatch);
        wrapper.appendChild(swatch);
        wrapper.appendChild(ratioElement);

        // Update aria attributes
        if (swatch.hasAttribute("aria-label")) {
          const ariaLabel = swatch.getAttribute("aria-label");
          if (!ariaLabel.includes("contrast ratio")) {
            swatch.setAttribute(
              "aria-label",
              `${ariaLabel} with contrast ratio ${contrastRatio}:1`
            );
          }
        }

        // Update title
        if (colorValue && !swatch.title.includes(contrastRatio)) {
          swatch.title = `${colorValue} (${contrastRatio}:1)`;
        }
      }
    } else if (swatch.closest(".swatch-with-ratio") && !showRatios) {
      // We need to remove the contrast ratio
      const wrapper = swatch.closest(".swatch-with-ratio");
      const parentContainer = wrapper.parentElement;

      // Move the swatch back to the parent container
      parentContainer.insertBefore(swatch, wrapper);
      wrapper.remove();

      // Update aria label to remove contrast info
      if (swatch.hasAttribute("aria-label")) {
        const ariaLabel = swatch.getAttribute("aria-label");
        if (ariaLabel.includes("with contrast ratio")) {
          const newLabel = ariaLabel.replace(
            /\s+with contrast ratio [0-9.]+:1/,
            ""
          );
          swatch.setAttribute("aria-label", newLabel);
        }
      }

      // Update title to remove contrast info if present
      if (swatch.title && swatch.title.includes("):1)")) {
        const colorPart = swatch.title.split(" ")[0];
        swatch.title = colorPart;
      }
    }
  });
}

// Set background preview
function setBackgroundPreview(color) {
  currentBackgroundColor = color;

  // Update preview toggle and swatch
  const previewBackgroundToggle = document.getElementById(
    "previewBackgroundToggle"
  );
  const backgroundPreviewSwatch = document.getElementById(
    "backgroundPreviewSwatch"
  );
  const previewControls = document.getElementById("backgroundPreviewControls");

  previewControls.style.display = "flex";
  backgroundPreviewSwatch.style.backgroundColor = color;

  // If toggle is checked or we're setting a new color, preview it
  if (!previewBackgroundToggle.checked) {
    previewBackgroundToggle.checked = true;
  }

  previewBackground(color);

  // Mark the selected background color in the UI
  markSelectedBackgroundColor();

  // Add notification about the applied background colour
  displayNotification(
    `Background colour ${color} has been applied to the preview.`,
    "info"
  );

  // If contrast ratios are shown, update them with the new background
  const showContrastRatios = document.getElementById("showContrastRatios");
  if (showContrastRatios && showContrastRatios.checked) {
    updateContrastRatioDisplay(true);
  }

  // Announce color change for screen readers
  const announcement = document.createElement("div");
  announcement.setAttribute("aria-live", "polite");
  announcement.setAttribute("class", "sr-only");
  announcement.textContent = `Background colour preview set to ${color}`;
  document.body.appendChild(announcement);

  // Add this at the end:
  updateSaveWithBackgroundButton();

  // Remove the announcement after it's been read
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 3000);
}

// Add CSS style for selected background color
function addSideBySideLayoutStyles() {
  const style = document.createElement("style");
  style.textContent = `

    `;
  document.head.appendChild(style);
}

// Preview background with SVG
function previewBackground(backgroundColor) {
  const containers = ["container1", "container2", "container3", "container4"];

  containers.forEach((id) => {
    const container = document.getElementById(id);
    if (container) {
      container.style.backgroundColor = backgroundColor;
    }
  });
}

// Clear background preview
function clearBackgroundPreview() {
  const containers = ["container1", "container2", "container3", "container4"];

  containers.forEach((id) => {
    const container = document.getElementById(id);
    if (container) {
      container.style.backgroundColor = "";
    }
  });

  currentBackgroundColor = null;
  updateSaveWithBackgroundButton();
}
// Suggest accessible color alternatives
function suggestAccessibleAlternatives(bestMatch, inputColors) {
  const { color: backgroundCandidate, failingColors } = bestMatch;

  // Clear previous results
  const resultsContainer = document.getElementById("backgroundResults");
  resultsContainer.innerHTML = "";

  // Create the suggestions container
  const suggestionsContainer = document.createElement("div");
  suggestionsContainer.className = "color-suggestions";

  // Add header and description
  const header = document.createElement("div");
  header.innerHTML = `
        <h3>Suggested Colour Replacements</h3>
        <p>The following colours in your SVG do not have sufficient contrast (3:1) with background ${backgroundCandidate}.</p>
        <p>Below are suggestions for each problematic colour that would meet contrast requirements while staying visually similar.</p>
    `;
  // Create numbered list of problematic colors
  const colorsList = document.createElement("ol");
  colorsList.className = "problematic-colors-list";
  failingColors.forEach((color, index) => {
    const listItem = document.createElement("li");
    listItem.innerHTML = `
        <div class="problem-color-item">
            <div class="color-swatch" style="background-color: ${color};" title="${color}"></div>
            <span>${color}</span>
        </div>
    `;
    colorsList.appendChild(listItem);
  });
  header.appendChild(colorsList);

  // Add the second paragraph
  const secondPara = document.createElement("p");
  secondPara.textContent = "";
  header.appendChild(secondPara);

  suggestionsContainer.appendChild(header);

  // Back button
  const backButton = document.createElement("button");
  backButton.className = "SVGCVDButton";
  backButton.textContent = "Back to Background Options";
  backButton.addEventListener("click", () => {
    findContrastingBackgrounds(); // Go back to the background results
  });
  suggestionsContainer.appendChild(backButton);

  // Show the selected background
  const bgPreview = document.createElement("div");
  bgPreview.className = "selected-bg-preview";
  bgPreview.innerHTML = `
        <div class="bg-preview-header">Selected Background:</div>
        <div class="bg-preview-swatch" style="background-color: ${backgroundCandidate};">
            <span class="bg-preview-value">${backgroundCandidate}</span>
        </div>
    `;
  suggestionsContainer.appendChild(bgPreview);

  // Create a container for the suggestions
  const colorSuggestions = document.createElement("div");
  colorSuggestions.className = "color-suggestions-list";

  // Process each problematic color
  const processingPromises = failingColors.map((originalColor, index) => {
    return new Promise((resolve) => {
      // Generate alternatives
      generateAccessibleAlternatives(
        originalColor,
        backgroundCandidate,
        3,
        (alternativeColors) => {
          // Create a suggestion card - now with index
          const suggestionCard = createSuggestionCard(
            originalColor,
            alternativeColors,
            backgroundCandidate,
            index // Pass the index
          );
          colorSuggestions.appendChild(suggestionCard);
          resolve();
        }
      );
    });
  });

  // Show loading indicator
  const loadingIndicator = document.createElement("div");
  loadingIndicator.className = "loading-indicator";
  loadingIndicator.textContent = "Generating accessible colour alternatives...";
  suggestionsContainer.appendChild(loadingIndicator);

  // When all suggestions are generated
  Promise.all(processingPromises).then(() => {
    // Remove loading indicator
    suggestionsContainer.removeChild(loadingIndicator);

    // Add the suggestions to the container
    suggestionsContainer.appendChild(colorSuggestions);
  });

  // Add to results container
  resultsContainer.appendChild(suggestionsContainer);

  // Set the background preview
  setBackgroundPreview(backgroundCandidate);
}

// Generate accessible color alternatives
function generateAccessibleAlternatives(
  originalColor,
  backgroundColor,
  targetContrast,
  callback
) {
  const alternatives = [];
  const originalLab = chroma(originalColor).lab();

  // Create variations by adjusting lightness
  const adjustLightness = (original, amount) => {
    const lab = chroma(original).lab();
    lab[0] = Math.max(0, Math.min(100, lab[0] + amount)); // Adjust L value while keeping it in range
    return chroma.lab(...lab).hex();
  };

  // Generate a list of candidate colors by varying lightness
  const lightnessCandidates = [];

  // Try lightening the color in small increments
  for (let i = 5; i <= 40; i += 5) {
    lightnessCandidates.push(adjustLightness(originalColor, i));
  }

  // Try darkening the color in small increments
  for (let i = 5; i <= 40; i += 5) {
    lightnessCandidates.push(adjustLightness(originalColor, -i));
  }

  // Check each candidate for contrast and calculate similarity
  lightnessCandidates.forEach((candidateColor) => {
    const contrast = getContrast(candidateColor, backgroundColor);

    if (contrast >= targetContrast) {
      // Calculate perceptual distance (delta E)
      const candidateLab = chroma(candidateColor).lab();
      const deltaE = chroma.deltaE(originalLab, candidateLab);

      alternatives.push({
        color: candidateColor,
        contrast: contrast,
        similarity: 100 - deltaE, // Higher is more similar
      });
    }
  });

  // If we don't have enough alternatives, try adjusting saturation too
  if (alternatives.length < 5) {
    // Generate more candidates by adjusting saturation as well
    const adjustSaturation = (original, amount) => {
      const hsv = chroma(original).hsv();
      hsv[1] = Math.max(0, Math.min(1, hsv[1] + amount)); // Adjust S value
      return chroma.hsv(...hsv).hex();
    };

    // Try combinations of lightness and saturation adjustments
    for (let l = 10; l <= 40; l += 10) {
      for (let s = -0.3; s <= 0.3; s += 0.1) {
        const adjustedColor = adjustSaturation(
          adjustLightness(originalColor, l),
          s
        );
        const contrast = getContrast(adjustedColor, backgroundColor);

        if (contrast >= targetContrast) {
          const adjustedLab = chroma(adjustedColor).lab();
          const deltaE = chroma.deltaE(originalLab, adjustedLab);

          alternatives.push({
            color: adjustedColor,
            contrast: contrast,
            similarity: 100 - deltaE,
          });
        }

        // Also try darkening
        const darkerColor = adjustSaturation(
          adjustLightness(originalColor, -l),
          s
        );
        const darkerContrast = getContrast(darkerColor, backgroundColor);

        if (darkerContrast >= targetContrast) {
          const darkerLab = chroma(darkerColor).lab();
          const darkerDeltaE = chroma.deltaE(originalLab, darkerLab);

          alternatives.push({
            color: darkerColor,
            contrast: darkerContrast,
            similarity: 100 - darkerDeltaE,
          });
        }
      }
    }
  }

  // Sort by similarity (highest first)
  alternatives.sort((a, b) => b.similarity - a.similarity);

  // Remove duplicates
  const uniqueAlternatives = [];
  const seen = new Set();

  alternatives.forEach((alt) => {
    if (!seen.has(alt.color)) {
      seen.add(alt.color);
      uniqueAlternatives.push(alt);
    }
  });

  // Return the top 5 most similar alternatives
  callback(uniqueAlternatives.slice(0, 5));
}

// Create a suggestion card for an original color and its alternatives
function createSuggestionCard(
  originalColor,
  alternatives,
  backgroundColor,
  index
) {
  const card = document.createElement("div");
  card.className = "suggestion-card";

  // Original color section - now with index
  const originalSection = document.createElement("div");
  originalSection.className = "original-color-section";
  originalSection.innerHTML = `
  <h4 class="CVDTool">Original Colour ${index + 1}: ${displayColourCode(
    originalColor
  )}</h4>
  <div class="color-display">
      <div class="color-swatch large-swatch" style="background-color: ${originalColor};" title="${displayColourCode(
    originalColor
  )}"></div>
      <div class="color-details">
          <div class="color-value">${displayColourCode(originalColor)}</div>
          <div class="contrast-value">Contrast: ${getContrast(
            originalColor,
            backgroundColor
          ).toFixed(2)}:1</div>
          <div class="contrast-status">Fails WCAG AA (3:1)</div>
      </div>
  </div>
`;

  // Alternatives section
  const alternativesSection = document.createElement("div");
  alternativesSection.className = "alternatives-section";
  alternativesSection.innerHTML =
    '<h4 class="CVDTool">Suggested Alternatives</h4>';

  // Use a div with role="radiogroup" instead of ul
  const alternativesGroup = document.createElement("div");
  alternativesGroup.className = "alternatives-list";
  alternativesGroup.setAttribute("role", "radiogroup");
  alternativesGroup.setAttribute("aria-label", "Alternative colours");

  // Add each alternative
  alternatives.forEach((alt, altIndex) => {
    // Use div instead of li
    const alternativeContainer = document.createElement("div");
    alternativeContainer.className = "alternative-container";

    // Create a button for each alternative (fully keyboard accessible)
    const alternativeBtn = document.createElement("button");
    alternativeBtn.className =
      "alternative-color" + (altIndex === 0 ? " selected" : "");
    alternativeBtn.setAttribute("type", "button");
    alternativeBtn.setAttribute("role", "radio");
    alternativeBtn.setAttribute(
      "aria-checked",
      altIndex === 0 ? "true" : "false"
    );
    alternativeBtn.setAttribute("data-color", alt.color);
    alternativeBtn.setAttribute("data-original-color", originalColor);

    // Add descriptive accessible name
    alternativeBtn.setAttribute(
      "aria-label",
      `Select colour ${alt.color} with contrast ${alt.contrast.toFixed(
        2
      )}:1 and similarity ${alt.similarity.toFixed(0)}%`
    );

    alternativeBtn.innerHTML = `
            <div class="color-swatch" style="background-color: ${
              alt.color
            };" title="${alt.color}"></div>
            <div class="alternative-details">
                <div class="color-value">${alt.color}</div>
                <div class="contrast-value">Contrast: ${alt.contrast.toFixed(
                  2
                )}:1</div>
                <div class="similarity-value">Similarity: ${alt.similarity.toFixed(
                  0
                )}%</div>
            </div>
        `;

    // Add click event to select this alternative
    alternativeBtn.addEventListener("click", () => {
      // Update aria-checked state for all alternatives
      alternativesGroup.querySelectorAll("[role='radio']").forEach((el) => {
        el.classList.remove("selected");
        el.setAttribute("aria-checked", "false");
      });

      // Add selected class to this alternative
      alternativeBtn.classList.add("selected");
      alternativeBtn.setAttribute("aria-checked", "true");

      // Preview replacement
      previewColorReplacement(originalColor, alt.color);
    });

    alternativeContainer.appendChild(alternativeBtn);
    alternativesGroup.appendChild(alternativeContainer);
  });

  alternativesSection.appendChild(alternativesGroup);

  // Apply button for this specific color
  const applyButton = document.createElement("button");
  applyButton.className = "SVGCVDButton apply-single-btn";
  applyButton.setAttribute("data-original-color", originalColor);
  applyButton.setAttribute("data-original-index", index + 1);

  // Set initial text based on the first selected alternative
  const initialSelected = alternatives[0];
  if (initialSelected) {
    // MODIFIED: Added colour swatches to the button content
    applyButton.innerHTML = `
      Replace Original Colour ${index + 1} 
      <div class="button-swatch" style="background-color: ${originalColor};" title="${originalColor}"></div> 
      ${originalColor} with 
      <div class="button-swatch" style="background-color: ${
        initialSelected.color
      };" title="${initialSelected.color}"></div> 
      ${initialSelected.color}
    `;

    // Set ARIA label for accessibility
    applyButton.setAttribute(
      "aria-label",
      `Replace Original Colour ${index + 1} (${originalColor}) with ${
        initialSelected.color
      }`
    );
  } else {
    applyButton.textContent = `Replace Original Colour ${
      index + 1
    } (${originalColor})`;
  }

  // Update when user selects a different alternative
  alternativesGroup.addEventListener("click", (event) => {
    const clicked = event.target.closest(".alternative-color");
    if (clicked && clicked.dataset.color) {
      // MODIFIED: Update button with colour swatches
      applyButton.innerHTML = `
        Replace Original Colour ${index + 1} 
        <div class="button-swatch" style="background-color: ${originalColor};" title="${originalColor}"></div> 
        ${originalColor} with 
        <div class="button-swatch" style="background-color: ${
          clicked.dataset.color
        };" title="${clicked.dataset.color}"></div> 
        ${clicked.dataset.color}
      `;

      // Update ARIA label
      applyButton.setAttribute(
        "aria-label",
        `Replace Original Colour ${index + 1} (${originalColor}) with ${
          clicked.dataset.color
        }`
      );
    }
  });

  applyButton.addEventListener("click", () => {
    const selected = alternativesGroup.querySelector(
      ".alternative-color.selected, [aria-checked='true']"
    );
    if (selected) {
      const replacementColor = selected.dataset.color;
      const replacements = {};
      replacements[originalColor] = replacementColor;
      applyColorReplacements(replacements, backgroundColor);
    }
  });

  // Add sections to card
  card.appendChild(originalSection);
  card.appendChild(alternativesSection);
  card.appendChild(applyButton);

  return card;
}

// Preview a color replacement in the SVG
function previewColorReplacement(originalColor, newColor) {
  // Store original color for reverting
  if (!window.originalSvgForPreview) {
    window.originalSvgForPreview =
      document.getElementById("container1").innerHTML;
  }

  // Create a temporary replacement object
  const tempReplacement = {};
  tempReplacement[originalColor] = newColor;

  // Parse SVG and replace colors
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(
    window.originalSvgForPreview,
    "image/svg+xml"
  );
  const elements = svgDoc.querySelectorAll("*");

  elements.forEach((el) => {
    const fillColor = el.getAttribute("fill");
    const strokeColor = el.getAttribute("stroke");

    // Normalize colors for comparison
    const normalizedFill = fillColor ? normalizeColour(fillColor) : null;
    const normalizedStroke = strokeColor ? normalizeColour(strokeColor) : null;

    if (normalizedFill === originalColor) {
      el.setAttribute("fill", newColor);
    }

    if (normalizedStroke === originalColor) {
      el.setAttribute("stroke", newColor);
    }
  });

  // Serialize and update display
  const serializer = new XMLSerializer();
  const updatedSvg = serializer.serializeToString(svgDoc);

  // Update all four views
  const containers = ["container1", "container2", "container3", "container4"];
  containers.forEach((id) => {
    const container = document.getElementById(id);
    if (container) {
      container.innerHTML = updatedSvg;
    }
  });
}
// Apply color replacements to the SVG
// First, we'll add our new helper function BEFORE the applyColorReplacements function
// This needs to be placed in the global scope so it's available to other functions

// Apply color replacements to the SVG
function applyColorReplacements(replacements, backgroundColor) {
  // Check if there are any replacements to apply
  if (Object.keys(replacements).length === 0) {
    displayNotification("No colour replacements selected.", "error");
    return;
  }

  // Update currentColorSwaps object with the new replacements
  for (const [original, replacement] of Object.entries(replacements)) {
    currentColorSwaps[original] = replacement;
  }

  // Apply all color swaps
  const parser = new DOMParser();
  const svgDoc = parser.parseFromString(originalSvg, "image/svg+xml");
  const elements = svgDoc.querySelectorAll("*");

  elements.forEach((el) => {
    const fillColor = el.getAttribute("fill");
    const strokeColor = el.getAttribute("stroke");

    if (fillColor) {
      const normalizedFill = normalizeColour(fillColor);
      if (currentColorSwaps[normalizedFill]) {
        el.setAttribute("fill", currentColorSwaps[normalizedFill]);
      }
    }

    if (strokeColor) {
      const normalizedStroke = normalizeColour(strokeColor);
      if (currentColorSwaps[normalizedStroke]) {
        el.setAttribute("stroke", currentColorSwaps[normalizedStroke]);
      }
    }
  });

  // Serialize and update display
  const serializer = new XMLSerializer();
  const updatedSvg = serializer.serializeToString(svgDoc);

  // Update the SVG display
  displaySvg(updatedSvg);

  // Set the background preview
  setBackgroundPreview(backgroundColor);

  // Create replacements summary for notification
  let replacementSummary = "";
  if (Object.keys(replacements).length <= 3) {
    // For few replacements, list them in the notification text
    const replacementPairs = Object.entries(replacements).map(
      ([original, replacement]) =>
        `${displayColourCode(original)} → ${displayColourCode(replacement)}`
    );
    replacementSummary = `: ${replacementPairs.join(", ")}`;
  }

  // Show success message
  displayNotification(
    `Applied ${
      Object.keys(replacements).length
    } colour replacements${replacementSummary}. The SVG now has improved contrast with the background colour.`,
    "success"
  );

  // Clear the originalSvgForPreview if it exists
  if (window.originalSvgForPreview) {
    delete window.originalSvgForPreview;
  }

  // Reset the background finder results with detailed replacement information
  const backgroundResults = document.getElementById("backgroundResults");

  // Create HTML for the color replacements list
  let replacementsListHTML = "";
  if (Object.keys(replacements).length > 0) {
    replacementsListHTML = '<div class="color-replacements-list">';
    replacementsListHTML += '<h4 class="CVDTool">Colours Changed:</h4>';
    replacementsListHTML += '<ul class="replacements-list">';

    for (const [originalColor, newColor] of Object.entries(replacements)) {
      replacementsListHTML += `
        <li class="replacement-item">
          <span class="replacement-label">Original:</span>
          <div class="color-swatch" style="background-color: ${originalColor};" title="${originalColor}"></div>
          <span class="replacement-value">${originalColor}</span>
          <span class="replacement-arrow" aria-hidden="true">→</span>
          <span class="replacement-label">New:</span>
          <div class="color-swatch" style="background-color: ${newColor};" title="${newColor}"></div>
          <span class="replacement-value">${newColor}</span>
        </li>
      `;
    }

    replacementsListHTML += "</ul></div>";
  }

  backgroundResults.innerHTML = `
        <div class="success-message">
            <p>Colour replacements applied successfully!</p>
            ${replacementsListHTML}
            <button id="findMoreBackgroundsBtn" class="SVGCVDButton">Find More Background Options</button>
        </div>
    `;

  // Add event listener to find more backgrounds button
  const findMoreBackgroundsBtn = document.getElementById(
    "findMoreBackgroundsBtn"
  );
  if (findMoreBackgroundsBtn) {
    findMoreBackgroundsBtn.addEventListener(
      "click",
      findContrastingBackgrounds
    );
  }
}

// Add background to SVG for saving
function addBackgroundToSvg(backgroundColor) {
  const parser = new DOMParser();
  const svgContent = document.getElementById("container1").innerHTML;
  const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
  const svg = svgDoc.querySelector("svg");

  if (svg) {
    // Get viewBox dimensions
    const viewBox = svg.getAttribute("viewBox");
    const [x, y, width, height] = viewBox
      ? viewBox.split(" ").map(Number)
      : [0, 0, 100, 100];

    // Create background rectangle
    const background = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "rect"
    );
    background.setAttribute("x", x);
    background.setAttribute("y", y);
    background.setAttribute("width", width);
    background.setAttribute("height", height);
    background.setAttribute("fill", backgroundColor);
    background.setAttribute("id", "background-rectangle");

    // Insert at beginning to be behind all other elements
    svg.insertBefore(background, svg.firstChild);

    // Get the updated SVG string
    const serializer = new XMLSerializer();
    const updatedSvg = serializer.serializeToString(svgDoc);

    // Update the display
    displaySvg(updatedSvg);

    return updatedSvg;
  }

  return svgContent;
}
// Show/hide the save with background button when a background is selected
function updateSaveWithBackgroundButton() {
  const saveWithBgBtn = document.getElementById("saveWithBgBtn");
  if (!saveWithBgBtn) return;

  if (currentBackgroundColor) {
    saveWithBgBtn.style.display = "inline-block";
    saveWithBgBtn.disabled = false;

    // Update button text with color swatch and uppercase colour code
    saveWithBgBtn.innerHTML = `Save SVG with <div class="button-swatch" style="background-color: ${currentBackgroundColor};" title="${displayColourCode(
      currentBackgroundColor
    )}"></div> ${displayColourCode(currentBackgroundColor)} background`;
  } else {
    saveWithBgBtn.style.display = "none";
    saveWithBgBtn.disabled = true;
  }
}

// Add function to save SVG with background
function saveSvgWithBackground() {
  if (!currentBackgroundColor) {
    displayNotification("No background colour selected.", "error");
    return;
  }

  try {
    // Get the original filename from the file input
    const originalFilename = fileInput.files[0]
      ? fileInput.files[0].name
      : "unnamed_svg";
    const baseFilename = originalFilename.replace(/\.[^/.]+$/, ""); // Remove file extension
    const sanitizedFilename = sanitizeFilename(baseFilename);

    // Add background to SVG
    const svgWithBackground = addBackgroundToSvg(currentBackgroundColor);

    if (!svgWithBackground) {
      throw new Error("No SVG content found to save.");
    }

    // Save SVG with background
    const svgBlob = new Blob([svgWithBackground], { type: "image/svg+xml" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const svgLink = document.createElement("a");
    svgLink.href = svgUrl;
    svgLink.download = `${sanitizedFilename}_with_background.svg`;

    // Create CSV content for color swaps
    let csvContent = "Original Color,Updated Color\n";
    for (const [originalColor, newColor] of Object.entries(currentColorSwaps)) {
      csvContent += `${displayColourCode(originalColor)},${displayColourCode(
        newColor
      )}\n`;
    }

    // Add background information to CSV with uppercase values
    csvContent += `\nBackground Color,${displayColourCode(
      currentBackgroundColor
    )}\n`;

    // Add background information to CSV
    csvContent += `\nBackground Color,${currentBackgroundColor.toUpperCase()}\n`;

    // Save CSV
    const csvBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(csvBlob);
    const csvLink = document.createElement("a");
    csvLink.href = csvUrl;
    csvLink.download = `${sanitizedFilename}_with_background_color_swap_data.csv`;

    // Trigger downloads
    document.body.appendChild(svgLink);
    document.body.appendChild(csvLink);

    svgLink.click();
    csvLink.click();

    document.body.removeChild(svgLink);
    document.body.removeChild(csvLink);

    URL.revokeObjectURL(svgUrl);
    URL.revokeObjectURL(csvUrl);

    displayNotification(
      `The SVG with background (${svgLink.download}) and color swap data CSV (${csvLink.download}) have been saved.`,
      "success"
    );
  } catch (error) {
    console.error("Error saving files:", error);
    displayNotification(
      `An error occurred while saving the files: ${error.message}`,
      "error"
    );
  }
}

// Save SVG with background if previewing
function saveWithBackground(originalSaveFunction) {
  try {
    // Check if a background is being previewed
    const previewBackgroundToggle = document.getElementById(
      "previewBackgroundToggle"
    );

    if (
      previewBackgroundToggle &&
      previewBackgroundToggle.checked &&
      currentBackgroundColor
    ) {
      // Add the background to the SVG before saving
      addBackgroundToSvg(currentBackgroundColor);

      // Call the original save function
      originalSaveFunction();

      // Update the notification to mention background
      const messageElement = document.getElementById("pageMessage");
      if (messageElement && messageElement.textContent.includes("saved")) {
        messageElement.textContent += ` The background colour ${currentBackgroundColor} has been added to the SVG.`;
      }
    } else {
      // Just call the original save function
      originalSaveFunction();
    }
  } catch (error) {
    console.error("Error saving with background:", error);
    displayNotification(
      `An error occurred while saving with background: ${error.message}`,
      "error"
    );
  }
}

function displaySingleColorAlternatives(
  originalColor,
  alternatives,
  backgroundColor
) {
  // Store the element that currently has focus to restore it later
  const previouslyFocusedElement = document.activeElement;

  // Create modal container
  const modalContainer = document.createElement("div");
  modalContainer.id = "singleColorAlternativesModal";
  modalContainer.className = "alternatives-modal";
  modalContainer.setAttribute("role", "dialog");
  modalContainer.setAttribute("aria-labelledby", "alternativesModalTitle");
  modalContainer.setAttribute("aria-modal", "true");

  // Create modal content with proper semantic structure
  modalContainer.innerHTML = `
      <div class="alternatives-modal-content">
          <div class="alternatives-modal-header">
              <h3 id="alternativesModalTitle" class="CVDTool">Alternative Colours for ${originalColor}</h3>
              <button id="closeAlternativesModal" class="close-modal-btn" aria-label="Close alternatives">×</button>
          </div>
          <div class="alternatives-modal-body">
              <div class="original-color-info">
                  <h4>Original Colour</h4>
                  <div class="color-display">
                      <div class="color-swatch large-swatch" style="background-color: ${originalColor};" title="${originalColor}"></div>
                      <div class="color-details">
                          <div class="color-value">${originalColor}</div>
                          <div class="contrast-value">Contrast: ${getContrast(
                            originalColor,
                            backgroundColor
                          ).toFixed(2)}:1</div>
                          <div class="contrast-status">Fails WCAG AA (3:1)</div>
                      </div>
                  </div>
              </div>
              
              <div class="alternatives-list-container">
                  <h4>Suggested Alternatives</h4>
                  <p>These colours have sufficient contrast with the background ${backgroundColor}:</p>
                  <div class="alternatives-list" role="radiogroup" aria-label="Alternative colours">
                      ${alternatives
                        .map(
                          (alt, index) => `
                          <div class="alternative-container">
                              <button class="alternative-color ${
                                index === 0 ? "selected" : ""
                              }" 
                                      type="button" 
                                      role="radio"
                                      aria-checked="${
                                        index === 0 ? "true" : "false"
                                      }"
                                      data-color="${alt.color}"
                                      aria-label="Select colour ${
                                        alt.color
                                      } with contrast ${alt.contrast.toFixed(
                            2
                          )}:1 and similarity ${alt.similarity.toFixed(0)}%">
                                  <div class="color-swatch" style="background-color: ${
                                    alt.color
                                  };" title="${alt.color}"></div>
                                  <div class="alternative-details">
                                      <div class="color-value">${
                                        alt.color
                                      }</div>
                                      <div class="contrast-value">Contrast: ${alt.contrast.toFixed(
                                        2
                                      )}:1</div>
                                      <div class="similarity-value">Similarity: ${alt.similarity.toFixed(
                                        0
                                      )}%</div>
                                  </div>
                              </button>
                          </div>
                      `
                        )
                        .join("")}
                  </div>
              </div>
              
              <div class="alternatives-modal-footer">
                  <button id="applySingleAlternative" class="SVGCVDButton">Apply Selected Colour</button>
                  <button id="cancelSingleAlternative" class="SVGCVDButton">Cancel</button>
              </div>
          </div>
      </div>
  `;

  // Add to document
  document.body.appendChild(modalContainer);

  // Prevent background scrolling when modal is open
  document.body.style.overflow = "hidden";

  // Store all focusable elements within the modal
  const focusableElements = modalContainer.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const firstFocusableElement = focusableElements[0];
  const lastFocusableElement = focusableElements[focusableElements.length - 1];

  // Function to close the modal
  const closeModal = () => {
    modalContainer.remove();
    // Restore background scrolling
    document.body.style.overflow = "";
    // Restore focus to the element that had it before the modal was opened
    if (previouslyFocusedElement) {
      previouslyFocusedElement.focus();
    }
  };

  // Add event listeners
  document
    .getElementById("closeAlternativesModal")
    .addEventListener("click", closeModal);
  document
    .getElementById("cancelSingleAlternative")
    .addEventListener("click", closeModal);

  // Handle selection of alternatives
  const alternativeButtons = modalContainer.querySelectorAll("[role='radio']");
  alternativeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Update selection state
      alternativeButtons.forEach((btn) => {
        btn.classList.remove("selected");
        btn.setAttribute("aria-checked", "false");
      });
      button.classList.add("selected");
      button.setAttribute("aria-checked", "true");
    });
  });

  // Apply selected alternative
  document
    .getElementById("applySingleAlternative")
    .addEventListener("click", () => {
      const selectedAlternative = modalContainer.querySelector(
        ".alternative-color.selected, [aria-checked='true']"
      );
      if (selectedAlternative) {
        const replacementColor = selectedAlternative.dataset.color;
        const replacements = {};
        replacements[originalColor] = replacementColor;

        // Apply the replacement
        applyColorReplacements(replacements, backgroundColor);

        // Close the modal
        closeModal();

        // Remove the suggestion box if it exists
        const suggestionBox = document.getElementById("contrastFixSuggestion");
        if (suggestionBox) {
          suggestionBox.remove();
        }
      }
    });

  // Trap focus inside modal - handle Tab key navigation
  modalContainer.addEventListener("keydown", (e) => {
    // Close on Escape key
    if (e.key === "Escape") {
      e.preventDefault();
      closeModal();
      return;
    }

    // Tab key handling for focus trapping
    if (e.key === "Tab") {
      // Shift + Tab
      if (e.shiftKey) {
        if (document.activeElement === firstFocusableElement) {
          e.preventDefault();
          lastFocusableElement.focus();
        }
      }
      // Tab without shift
      else {
        if (document.activeElement === lastFocusableElement) {
          e.preventDefault();
          firstFocusableElement.focus();
        }
      }
    }
  });

  // Set initial focus on the first interactive element
  if (firstFocusableElement) {
    firstFocusableElement.focus();
  }

  // Announce modal to screen readers via aria-live
  const announcer = document.createElement("div");
  announcer.setAttribute("aria-live", "polite");
  announcer.className = "sr-only";
  announcer.textContent = `Dialog opened: Alternative colours for ${originalColor}`;
  document.body.appendChild(announcer);

  // Remove the announcer after it's been read
  setTimeout(() => {
    if (document.body.contains(announcer)) {
      document.body.removeChild(announcer);
    }
  }, 1000);
}
// New function to integrate with color swapping
function integrateWithColorSwapping() {
  // Monitor color swap interface for changes
  const originalUpdateSvgColors = window.updateSvgColors;

  if (typeof originalUpdateSvgColors === "function") {
    window.updateSvgColors = function (originalColor, newColor) {
      // Call the original function
      originalUpdateSvgColors(originalColor, newColor);

      // Then validate contrast if we have a background
      if (currentBackgroundColor && newColor) {
        validateBackgroundContrast(newColor);
      }
    };
  }
}

// Validate contrast with background
function validateBackgroundContrast(changedColor) {
  if (!changedColor || !currentBackgroundColor) return;

  // Remove any existing contrast fix suggestions and highlights
  clearContrastWarnings();

  const contrastRatio = getContrast(changedColor, currentBackgroundColor);
  const targetContrast = 3; // WCAG AA for UI components

  if (contrastRatio < targetContrast) {
    // Find the specific color item for this color
    insertContrastWarningAfterColor(changedColor, contrastRatio);
  }
}
// Clear all contrast warnings and highlights
function clearContrastWarnings() {
  // Remove any existing contrast fix suggestions
  const existingSuggestions = document.querySelectorAll(
    ".contrast-fix-suggestion"
  );
  existingSuggestions.forEach((suggestion) => suggestion.remove());

  // Remove any existing color item highlights
  const highlightedItems = document.querySelectorAll(
    ".color-item.has-contrast-issue"
  );
  highlightedItems.forEach((item) =>
    item.classList.remove("has-contrast-issue")
  );
}

// Insert a contrast warning directly after the specific color item
function insertContrastWarningAfterColor(problematicColor, contrastRatio) {
  // Normalize the color for comparison
  const normalizedColor = problematicColor.toUpperCase();

  // Find the color item
  const colorItems = document.querySelectorAll(".color-item");
  let targetItem = null;

  for (const item of colorItems) {
    const colorSpan = item.querySelector(".color-item-span");
    if (colorSpan && colorSpan.textContent.toUpperCase() === normalizedColor) {
      targetItem = item;
      break;
    }
  }

  if (!targetItem) return;

  // Mark the item as having a contrast issue
  targetItem.classList.add("has-contrast-issue");

  // Create the warning element
  const warningDiv = document.createElement("div");
  warningDiv.className = "contrast-fix-suggestion inline-warning";
  warningDiv.innerHTML = `
    <p><strong>Contrast issue:</strong> This colour has ${contrastRatio.toFixed(
      2
    )}:1 contrast with the background (needs 3:1). Would you like to:</p>
    <button class="SVGCVDButton find-bg-btn">Find a new background colour</button>
    <button class="SVGCVDButton suggest-alt-btn">Suggest better colour alternatives</button>
    <button class="SVGCVDButton dismiss-btn">Dismiss</button>
  `;

  // Insert the warning directly after the target item
  targetItem.insertAdjacentElement("afterend", warningDiv);

  // Add event listeners
  warningDiv
    .querySelector(".find-bg-btn")
    .addEventListener("click", findContrastingBackgrounds);
  warningDiv.querySelector(".suggest-alt-btn").addEventListener("click", () => {
    suggestAccessibleAlternativesForSingle(
      problematicColor,
      currentBackgroundColor
    );
  });
  warningDiv.querySelector(".dismiss-btn").addEventListener("click", () => {
    warningDiv.remove();
    targetItem.classList.remove("has-contrast-issue");
  });

  // Focus the warning for accessibility
  setTimeout(() => {
    warningDiv.setAttribute("tabindex", "-1");
    warningDiv.focus();
  }, 100);
}

// Add a warning and suggestions for fixing contrast issues
function addContrastFixSuggestion(problematicColor) {
  // Check if suggestion already exists and remove it
  const existingSuggestion = document.getElementById("contrastFixSuggestion");
  if (existingSuggestion) {
    existingSuggestion.remove();
  }

  // Find the specific color-item that matches our problematic color
  const normalizedProblematicColor = problematicColor.toUpperCase();
  let targetColorItem = null;

  // Find the matching color item
  const colorItems = document.querySelectorAll(".color-item");
  for (const item of colorItems) {
    const colorSpan = item.querySelector(".color-item-span");
    if (
      colorSpan &&
      colorSpan.textContent.toUpperCase() === normalizedProblematicColor
    ) {
      targetColorItem = item;
      break;
    }
  }

  // Remove any existing highlighting classes
  colorItems.forEach((item) => {
    item.classList.remove("has-contrast-issue");
  });

  // Add a visual highlighter to the problematic color
  if (targetColorItem) {
    targetColorItem.classList.add("has-contrast-issue");

    // Calculate position for a visual indicator
    const targetRect = targetColorItem.getBoundingClientRect();
    const colorSwapInterface = document.getElementById("colorSwapInterface");
    const interfaceRect = colorSwapInterface.getBoundingClientRect();

    // Create visual connector (optional)
    const connector = document.createElement("div");
    connector.className = "contrast-issue-connector";
    connector.id = "contrastIssueConnector";
    document.body.appendChild(connector);
  }

  // Create the suggestion box (with reference to the specific color)
  const suggestionBox = document.createElement("div");
  suggestionBox.id = "contrastFixSuggestion";
  suggestionBox.className = "contrast-fix-suggestion";
  suggestionBox.setAttribute("role", "alert");
  suggestionBox.innerHTML = `
      <p><strong>Contrast issue with ${problematicColor}:</strong> This colour doesn't have sufficient contrast with the background. Would you like to:</p>
      <button id="findNewBackgroundBtn" class="SVGCVDButton">Find a new background colour</button>
      <button id="suggestBetterColorBtn" class="SVGCVDButton">Suggest better colour alternatives</button>
      <button id="dismissWarningBtn" class="SVGCVDButton">Dismiss</button>
  `;

  // Add event listeners for the buttons
  suggestionBox
    .querySelector("#findNewBackgroundBtn")
    .addEventListener("click", findContrastingBackgrounds);
  suggestionBox
    .querySelector("#suggestBetterColorBtn")
    .addEventListener("click", () => {
      suggestAccessibleAlternativesForSingle(
        problematicColor,
        currentBackgroundColor
      );
    });
  suggestionBox
    .querySelector("#dismissWarningBtn")
    .addEventListener("click", () => {
      // Also remove highlighting when dismissed
      if (targetColorItem) {
        targetColorItem.classList.remove("has-contrast-issue");
      }
      // Remove connector if it exists
      const connector = document.getElementById("contrastIssueConnector");
      if (connector) {
        connector.remove();
      }
      suggestionBox.remove();
    });

  // Add to the paletteSelection div (where it's expected in the structure)
  const paletteSelection = document.getElementById("paletteSelection");
  paletteSelection.appendChild(suggestionBox);

  // Scroll to the problematic color
  if (targetColorItem) {
    // Scroll the color into view first
    targetColorItem.scrollIntoView({ behavior: "smooth", block: "center" });

    // Then after a short delay, scroll to show both the color and suggestion
    setTimeout(() => {
      // Calculate position that shows both elements
      const targetBottom = targetColorItem.getBoundingClientRect().bottom;
      const viewportHeight = window.innerHeight;
      const scrollAdjustment = targetBottom - viewportHeight * 0.7; // Position to show both

      // Adjust scroll position to show both elements
      window.scrollBy({
        top: scrollAdjustment,
        behavior: "smooth",
      });
    }, 300);
  }
}

// Helper function to suggest alternatives for a single colour
function suggestAccessibleAlternativesForSingle(
  originalColor,
  backgroundColor
) {
  // Check if chroma.js is loaded
  if (typeof chroma === "undefined") {
    loadChromaJs(() =>
      suggestAccessibleAlternativesForSingle(originalColor, backgroundColor)
    );
    return;
  }

  // Show loading message
  displayNotification("Generating accessible colour alternatives...", "info");

  // Generate alternatives
  generateAccessibleAlternatives(
    originalColor,
    backgroundColor,
    3,
    (alternatives) => {
      if (alternatives.length > 0) {
        // Display alternatives in a modal
        displaySingleColorAlternatives(
          originalColor,
          alternatives,
          backgroundColor
        );
      } else {
        displayNotification(
          "No suitable alternatives found. Consider changing the background colour instead.",
          "error"
        );
      }
    }
  );
}

// Fix WCAG 4.1.2 issue: Add role="img" to color swatches with aria-label attributes
function fixColorSwatchAccessibility() {
  // Fix all swatches with aria-label that don't have a role
  document
    .querySelectorAll(".color-swatch[aria-label]:not([role])")
    .forEach((swatch) => {
      swatch.setAttribute("role", "img");
    });
}

// Run when the DOM content is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Fix initial swatches
  fixColorSwatchAccessibility();

  // Set up a MutationObserver to fix any swatches added dynamically after page load
  const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      if (mutation.addedNodes && mutation.addedNodes.length > 0) {
        // Wait a small amount of time to ensure all aria-labels have been applied
        setTimeout(fixColorSwatchAccessibility, 10);
      }
    });
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, { childList: true, subtree: true });
});

// Patch the createElement method to automatically add role="img" to color swatches
// This ensures any new swatches created programmatically will have the correct role
const originalCreateElement = document.createElement;
document.createElement = function (tagName) {
  const element = originalCreateElement.call(document, tagName);

  // If we're creating a div that might become a color swatch
  if (tagName.toLowerCase() === "div") {
    // Store the original setAttribute method
    const originalSetAttribute = element.setAttribute;

    // Override setAttribute to add role="img" when aria-label is added to a color swatch
    element.setAttribute = function (name, value) {
      // Call the original method first
      originalSetAttribute.call(this, name, value);

      // If this is a color swatch getting an aria-label, add the role
      if (
        name === "aria-label" &&
        this.className &&
        this.className.includes("color-swatch") &&
        !this.hasAttribute("role")
      ) {
        originalSetAttribute.call(this, "role", "img");
      }
    };
  }

  return element;
};

// Initialize the background finder when the page loads
document.addEventListener("DOMContentLoaded", function () {
  // Check if chroma.js is already loaded
  if (typeof chroma === "undefined") {
    // Load chroma.js
    loadChromaJs(() => {
      initBackgroundFinder();
    });
  } else {
    initBackgroundFinder();
  }
});
