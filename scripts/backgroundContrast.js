document.addEventListener("DOMContentLoaded", function () {
  const form = document.getElementById("contrast-form");
  const colourInput = document.getElementById("colour-input");
  const errorMessage = document.getElementById("error-message");
  const resultsSection = document.getElementById("results");
  const resultHeading = document.getElementById("result-heading");
  const colourGroups = document.getElementById("colour-groups");
  const similarColoursSection = document.getElementById(
    "similar-colours-section"
  );
  const similarColoursHeading = document.getElementById(
    "similar-colours-heading"
  );
  const similarColoursGrid = document.querySelector(".similar-colours-grid");
  const similarPagination = document.getElementById("similar-pagination");
  const backToResultsBtn = document.getElementById("back-to-results");
  const contrastDetails = document.getElementById("contrast-details");
  const contrastPairs = document.getElementById("contrast-pairs");

  // New input method elements
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");
  const colourFile = document.getElementById("colour-file");
  const filePreview = document.getElementById("file-preview");
  const previewColours = document.getElementById("preview-colours");

  // Original colours (will be used when generating similar colours)
  let originalMatchingColours = [];
  // Current input colours (will be used for contrast checking)
  let currentInputColours = [];
  // Current target contrast
  let currentTargetContrast = 3;
  // Track active input method
  let activeInputMethod = "manual-input";
  // Store loaded colours from file
  let loadedColours = [];

  // Colour groups definitions
  const colourCategoryDefinitions = {
    whites: { name: "Whites & Off-whites", sampleColor: "#F5F5F5" },
    greys: { name: "Greys", sampleColor: "#808080" },
    blacks: { name: "Blacks & Off-blacks", sampleColor: "#222222" },
    reds: { name: "Reds", sampleColor: "#CC0000" },
    oranges: { name: "Oranges & Browns", sampleColor: "#CC6600" },
    yellows: { name: "Yellows", sampleColor: "#CCCC00" },
    greens: { name: "Greens", sampleColor: "#00CC00" },
    cyans: { name: "Cyans", sampleColor: "#00CCCC" },
    blues: { name: "Blues", sampleColor: "#0066CC" },
    purples: { name: "Purples", sampleColor: "#6600CC" },
    pinks: { name: "Pinks & Magentas", sampleColor: "#CC00CC" },
  };

  // Handle tab switching
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      // Remove active class from all buttons and tabs
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      // Add active class to clicked button and corresponding tab
      button.classList.add("active");
      const tabId = button.getAttribute("data-tab");
      document.getElementById(tabId).classList.add("active");

      // Update active input method
      activeInputMethod = tabId;

      // Toggle required attribute on the textarea based on active tab
      if (tabId === "manual-input") {
        colourInput.setAttribute("required", "required");
      } else {
        colourInput.removeAttribute("required");
      }

      // Clear error message
      errorMessage.style.display = "none";
    });
  });

  // Handle file selection
  colourFile.addEventListener("change", function (e) {
    const file = e.target.files[0];
    if (!file) {
      return;
    }

    // Clear previous error and preview
    errorMessage.style.display = "none";
    previewColours.innerHTML = "";
    loadedColours = [];

    // Check file type
    const fileType = file.name.split(".").pop().toLowerCase();
    if (fileType !== "csv" && fileType !== "json") {
      errorMessage.textContent = "Please upload a CSV or JSON file.";
      errorMessage.style.display = "block";
      colourFile.value = "";
      filePreview.classList.add("hidden");
      return;
    }

    const reader = new FileReader();

    reader.onload = function (event) {
      const fileContent = event.target.result;

      try {
        if (fileType === "csv") {
          processCSVContent(fileContent);
        } else if (fileType === "json") {
          processJSONContent(fileContent);
        }

        // Show preview if colours were loaded successfully
        if (loadedColours.length > 0) {
          displayColourPreview();
          filePreview.classList.remove("hidden");
        } else {
          errorMessage.textContent = "No valid colours found in the file.";
          errorMessage.style.display = "block";
          filePreview.classList.add("hidden");
        }
      } catch (error) {
        console.error("Error processing file:", error);
        errorMessage.textContent =
          "Error processing file. Please check the file format.";
        errorMessage.style.display = "block";
        filePreview.classList.add("hidden");
      }
    };

    reader.onerror = function () {
      errorMessage.textContent = "Error reading file.";
      errorMessage.style.display = "block";
      filePreview.classList.add("hidden");
    };

    reader.readAsText(file);
  });

  // Process CSV content
  function processCSVContent(content) {
    // Clean the content by removing quotes and spaces
    const cleanedContent = content.replace(/['"]/g, "").trim();

    // Handle different CSV formats
    let lines;
    if (cleanedContent.includes("\n")) {
      // Multiple lines format
      lines = cleanedContent.split("\n");
    } else {
      // Single line format
      lines = [cleanedContent];
    }

    // Process each line
    lines.forEach((line) => {
      if (line.trim() === "") return;

      // Split by comma
      const values = line.split(",");

      // Process each value
      values.forEach((value) => {
        const cleanValue = value.trim();
        if (cleanValue === "") return;

        // Validate and normalize the colour
        if (
          isValidHexColour(cleanValue) ||
          isValidHexColour(cleanValue.replace(/^#/, ""))
        ) {
          const normalizedColour = normalizeColour(cleanValue);
          loadedColours.push(normalizedColour);
        }
      });
    });
  }

  // Process JSON content
  function processJSONContent(content) {
    try {
      const data = JSON.parse(content);

      // Get the first palette
      const firstPaletteName = Object.keys(data)[0];
      if (!firstPaletteName || !Array.isArray(data[firstPaletteName])) {
        throw new Error(
          'Invalid JSON format. Expected {"paletteName": ["#colour1", "#colour2", ...]}'
        );
      }

      // Process colours from the first palette
      data[firstPaletteName].forEach((colour) => {
        // Clean the value
        const cleanValue = String(colour).trim().replace(/['"]/g, "");

        // Validate and normalize the colour
        if (
          isValidHexColour(cleanValue) ||
          isValidHexColour(cleanValue.replace(/^#/, ""))
        ) {
          const normalizedColour = normalizeColour(cleanValue);
          loadedColours.push(normalizedColour);
        }
      });
    } catch (error) {
      console.error("Error parsing JSON:", error);
      throw new Error(
        'Invalid JSON format. Expected {"paletteName": ["#colour1", "#colour2", ...]}'
      );
    }
  }

  // Display colour preview
  function displayColourPreview() {
    previewColours.innerHTML = "";

    // Limit preview to the first 12 colours to avoid overcrowding
    const previewLimit = Math.min(loadedColours.length, 12);

    for (let i = 0; i < previewLimit; i++) {
      const colour = loadedColours[i];
      const previewSwatch = document.createElement("div");
      previewSwatch.className = "preview-colour";
      previewSwatch.style.backgroundColor = colour;
      previewSwatch.setAttribute("data-colour", colour);
      previewColours.appendChild(previewSwatch);
    }

    // Add count indicator if more colours were loaded than shown
    if (loadedColours.length > previewLimit) {
      const countIndicator = document.createElement("div");
      countIndicator.className = "colour-count";
      countIndicator.textContent = `+${
        loadedColours.length - previewLimit
      } more`;
      previewColours.appendChild(countIndicator);
    }
  }

  // Validate a single hex colour code
  function isValidHexColour(colour) {
    // Remove # if present
    const hex = colour.startsWith("#") ? colour.substring(1) : colour;

    // Check if it's a valid 6-character hex
    return /^[0-9A-Fa-f]{6}$/.test(hex);
  }

  // Parse colour input and validate
  function parseColours(input) {
    // Check if input has line breaks
    if (input.includes("\n")) {
      // Split by line breaks
      return input
        .split("\n")
        .map((colour) => colour.trim())
        .filter((colour) => colour !== "");
    } else if (input.includes(",")) {
      // Split by commas
      return input
        .split(",")
        .map((colour) => colour.trim())
        .filter((colour) => colour !== "");
    } else {
      // Split by whitespace (for inputs like "#C1D100 #FCBC00 #EF7D00")
      return input
        .split(/\s+/)
        .map((colour) => colour.trim())
        .filter((colour) => colour !== "");
    }
  }

  // Normalize a colour to 6-character hex with # prefix
  function normalizeColour(colour) {
    // Remove # if present
    let hex = colour.trim();
    hex = hex.startsWith("#") ? hex.substring(1) : hex;
    return "#" + hex.toUpperCase();
  }

  // Calculate contrast using chroma.js
  function getContrast(colour1, colour2) {
    try {
      return chroma.contrast(colour1, colour2);
    } catch (e) {
      console.error("Error calculating contrast:", e);
      return 0;
    }
  }

  // Determine colour group based on the colour
  function determineColourGroup(colour) {
    const c = chroma(colour);
    const hsl = c.hsl();
    const h = hsl[0] || 0; // hue
    const s = hsl[1] || 0; // saturation
    const l = hsl[2] || 0; // lightness

    // Achromatic colours (whites, greys, blacks)
    if (s < 0.15) {
      if (l > 0.85) return "whites";
      if (l < 0.15) return "blacks";
      return "greys";
    }

    // Chromatic colours based on hue
    if (h >= 0 && h < 30) return "reds";
    if (h >= 30 && h < 60) return "oranges";
    if (h >= 60 && h < 90) return "yellows";
    if (h >= 90 && h < 150) return "greens";
    if (h >= 150 && h < 195) return "cyans";
    if (h >= 195 && h < 270) return "blues";
    if (h >= 270 && h < 330) return "purples";
    return "pinks"; // 330-360
  }

  // Group matching colours by colour category
  function groupMatchingColours(matches) {
    const grouped = {};

    // Initialize groups
    Object.keys(colourCategoryDefinitions).forEach((group) => {
      grouped[group] = [];
    });

    // Assign colours to groups
    matches.forEach((match) => {
      const group = determineColourGroup(match.colour);
      grouped[group].push(match);
    });

    // Remove empty groups
    Object.keys(grouped).forEach((group) => {
      if (grouped[group].length === 0) {
        delete grouped[group];
      }
    });

    return grouped;
  }
  /**
   * Improved function to actually find at least one similar colour that meets contrast requirements
   * rather than just predicting if it's likely. This ensures we only show the "More like this" button
   * when we are certain we can find at least one similar colour.
   *
   * @param {string} referenceColour - The hex colour code to find similar colours for
   * @param {string[]} inputColours - Array of hex colour codes to check contrast against
   * @param {number} targetContrast - Minimum contrast ratio required
   * @returns {boolean} True if at least one similar colour found, false otherwise
   */
  function findAtLeastOneSimilarColour(
    referenceColour,
    inputColours,
    targetContrast
  ) {
    // Skip logging for brevity

    // Check inputs
    if (!inputColours || inputColours.length === 0) {
      return false;
    }

    // If only checking against one colour, we can always find similar colours
    // (as long as the one colour isn't identical to the reference colour)
    if (
      inputColours.length === 1 &&
      inputColours[0].toLowerCase() !== referenceColour.toLowerCase()
    ) {
      return true;
    }

    try {
      // Convert to Lab colour space for more perceptually uniform variations
      const baseLab = chroma(referenceColour).lab();

      // Constants for our variation generation - expanded for more thorough testing
      const L_VARIATIONS = [0, -5, 5, -10, 10, -15, 15, -20, 20, -25, 25]; // More lightness variations
      const A_VARIATIONS = [0, -5, 5, -10, 10, -15, 15]; // More a-axis variations
      const B_VARIATIONS = [0, -5, 5, -10, 10, -15, 15]; // More b-axis variations

      // Get the base Lab values
      const baseL = baseLab[0];
      const baseA = baseLab[1];
      const baseB = baseLab[2];

      // For achromatic colours (greys), we'll need more variations
      const isAchromatic = Math.abs(baseA) < 5 && Math.abs(baseB) < 5;

      // For very light or very dark colours, we need more extreme variations
      const isVeryLight = baseL > 85;
      const isVeryDark = baseL < 15;

      // Build variations list based on colour characteristics
      const variations = [];
      let foundAtLeastOne = false;
      let countTested = 0;
      let maxVariationsToTest = 300; // Set a reasonable limit to avoid excessive testing

      // Create standard variations
      for (const lVar of L_VARIATIONS) {
        // Skip invalid lightness values
        const l = baseL + lVar;
        if (l < 0 || l > 100) continue;

        // Basic variations around the current colour
        variations.push([l, baseA, baseB]);

        // For the original lightness, check more A/B variations
        if (lVar === 0) {
          for (const aVar of A_VARIATIONS) {
            for (const bVar of B_VARIATIONS) {
              if (aVar === 0 && bVar === 0) continue; // Skip the original
              variations.push([l, baseA + aVar, baseB + bVar]);
            }
          }
        } else {
          // For non-zero lightness changes, still add some a/b variations
          // but with fewer combinations to avoid too many tests
          variations.push([l, baseA + 10, baseB]);
          variations.push([l, baseA - 10, baseB]);
          variations.push([l, baseA, baseB + 10]);
          variations.push([l, baseA, baseB - 10]);
        }

        // For achromatic colours, add some chroma at different lightness levels
        if (isAchromatic) {
          variations.push([l, 20, 0]); // Reddish
          variations.push([l, -20, 0]); // Greenish
          variations.push([l, 0, 20]); // Yellowish
          variations.push([l, 0, -20]); // Bluish
          variations.push([l, 15, 15]); // Orange-ish
          variations.push([l, -15, 15]); // Green-yellow
          variations.push([l, 15, -15]); // Purple-ish
          variations.push([l, -15, -15]); // Blue-green
        }
      }

      // Add more extreme variations for edge cases
      if (isVeryLight) {
        // Add darker variations
        for (let i = 30; i <= 60; i += 10) {
          variations.push([baseL - i, baseA, baseB]);
          // Also add some variations with different chroma
          variations.push([baseL - i, baseA + 10, baseB]);
          variations.push([baseL - i, baseA, baseB + 10]);
        }
      }

      if (isVeryDark) {
        // Add lighter variations
        for (let i = 30; i <= 60; i += 10) {
          variations.push([baseL + i, baseA, baseB]);
          // Also add some variations with different chroma
          variations.push([baseL + i, baseA + 10, baseB]);
          variations.push([baseL + i, baseA, baseB + 10]);
        }
      }

      // Track successful variations for logging
      const passingColours = [];

      // Check each variation - but stop as soon as we find enough that work
      for (const [l, a, b] of variations) {
        // Limit the number of tests to avoid performance issues
        if (countTested >= maxVariationsToTest) {
          break;
        }

        countTested++;

        try {
          // Create a colour from these Lab coordinates
          const testColour = chroma.lab(l, a, b).hex();

          // Skip if this is the same as the reference colour
          if (testColour.toLowerCase() === referenceColour.toLowerCase()) {
            continue;
          }

          // Check contrast with all input colours
          let allPass = true;
          let minContrastFound = Infinity;

          for (const colour of inputColours) {
            const contrast = chroma.contrast(testColour, colour);
            minContrastFound = Math.min(minContrastFound, contrast);

            if (contrast < targetContrast) {
              allPass = false;
              break;
            }
          }

          // If this variation passes with all input colours, add it to our list
          if (allPass) {
            foundAtLeastOne = true;
            passingColours.push({
              colour: testColour,
              minContrast: minContrastFound,
              distance: chroma.distance(testColour, referenceColour),
            });

            // If we've found 3 passing colours, we can be confident there are more
            if (passingColours.length >= 3) {
              return true;
            }
          }
        } catch (e) {
          // Skip invalid colours
          continue;
        }
      }

      // If we found at least one colour that works, return true
      if (foundAtLeastOne) {
        return true;
      }

      // If we've tried all variations and found nothing, return false
      return false;
    } catch (e) {
      console.error("Error in findAtLeastOneSimilarColour:", e);
      return false;
    }
  }

  // Enhanced version of findMatchingColours funct
  //ion
  // Enhanced version of findMatchingColours function with generateColourCandidates properly included
  function findMatchingColours(colours, targetContrast) {
    const matches = [];
    const partialMatches = {};
    const maxMatches = 200;

    // Generate colour candidates - starting points and variations
    const candidates = generateColourCandidates();

    // Track best partial match size (number of colours that pass)
    let bestPartialMatchSize = 0;

    // Check each candidate against all input colours
    for (const candidate of candidates) {
      // Skip if we already have enough full matches
      if (matches.length >= maxMatches) break;

      let passCount = 0;
      const contrastValues = [];
      const passingColours = [];
      const failingColours = [];

      // Check contrast with each input colour
      for (const colour of colours) {
        const contrast = getContrast(candidate, colour);
        contrastValues.push(contrast);

        if (contrast >= targetContrast) {
          passCount++;
          passingColours.push(colour);
        } else {
          failingColours.push(colour);
        }
      }

      // If all colours pass, add to full matches
      if (passCount === colours.length) {
        matches.push({
          colour: candidate,
          minContrast: Math.min(...contrastValues),
          avgContrast:
            contrastValues.reduce((a, b) => a + b, 0) / contrastValues.length,
          passingColours,
          failingColours,
        });
      }
      // If this is a partial match but as good or better than our best so far
      else if (passCount >= 2 && passCount >= bestPartialMatchSize) {
        // If we found a better size, clear previous partial matches
        if (passCount > bestPartialMatchSize) {
          Object.keys(partialMatches).forEach((key) => {
            if (partialMatches[key].length >= maxMatches) {
              return; // Skip if we already have enough matches for this size
            }
          });
          bestPartialMatchSize = passCount;
        }

        // Initialize the array for this pass count if needed
        if (!partialMatches[passCount]) {
          partialMatches[passCount] = [];
        }

        // Add to partial matches if we don't have too many already
        if (partialMatches[passCount].length < maxMatches) {
          partialMatches[passCount].push({
            colour: candidate,
            minContrast: Math.min(
              ...passingColours.map((color) => getContrast(candidate, color))
            ),
            avgContrast:
              contrastValues.reduce((a, b) => a + b, 0) / contrastValues.length,
            matchCount: passCount,
            totalCount: colours.length,
            passingColours,
            failingColours,
          });
        }
      }
    }

    // If we found full matches, return those
    if (matches.length > 0) {
      // Sort by minimum contrast (highest first) as primary sort, then average contrast as secondary sort
      return {
        fullMatches: matches.sort((a, b) => {
          // If min contrast is the same (within 0.1), sort by average contrast
          if (Math.abs(b.minContrast - a.minContrast) < 0.1) {
            return b.avgContrast - a.avgContrast;
          }
          return b.minContrast - a.minContrast;
        }),
        partialMatches: null,
        bestPartialSize: 0,
      };
    }

    // Otherwise, return the best partial matches
    if (bestPartialMatchSize > 0) {
      // Sort the best partial matches (highest min contrast first)
      const bestPartialSet = partialMatches[bestPartialMatchSize].sort(
        (a, b) => {
          // If min contrast is the same (within 0.1), sort by average contrast
          if (Math.abs(b.minContrast - a.minContrast) < 0.1) {
            return b.avgContrast - a.avgContrast;
          }
          return b.minContrast - a.minContrast;
        }
      );

      return {
        fullMatches: [],
        partialMatches: bestPartialSet,
        bestPartialSize: bestPartialMatchSize,
      };
    }

    // No matches found at all
    return {
      fullMatches: [],
      partialMatches: null,
      bestPartialSize: 0,
    };

    // Generate candidate colours - more options across all colour ranges
    function generateColourCandidates() {
      const candidates = [];

      // Near-white colours (off-whites)
      for (let i = 92; i <= 98; i += 1) {
        const hex = Math.floor(i * 2.55)
          .toString(16)
          .padStart(2, "0");
        candidates.push(`#${hex}${hex}${hex}`);
      }
      candidates.push("#FFFFFF");

      // Near-black colours (off-blacks)
      for (let i = 1; i <= 12; i += 1) {
        const hex = Math.floor(i * 2.55)
          .toString(16)
          .padStart(2, "0");
        candidates.push(`#${hex}${hex}${hex}`);
      }
      candidates.push("#000000");

      // Grey scale with small increments for more options
      for (let i = 15; i <= 85; i += 5) {
        const hex = Math.floor(i * 2.55)
          .toString(16)
          .padStart(2, "0");
        candidates.push(`#${hex}${hex}${hex}`);
      }

      // Generate colours in HSL space for better coverage
      // Hues (0-360 degrees)
      const hues = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];

      // Saturations (0-100%)
      const saturations = [20, 40, 60, 80];

      // Lightness (0-100%)
      const lightnesses = [10, 20, 30, 40, 50, 60, 70, 80, 90];

      // Generate colours from HSL combinations
      hues.forEach((h) => {
        saturations.forEach((s) => {
          lightnesses.forEach((l) => {
            // Convert to chroma.js format (0-1 range)
            const colour = chroma(h, s / 100, l / 100, "hsl");
            candidates.push(colour.hex());
          });
        });
      });

      return candidates;
    }
  }

  // Generate similar colours based on a reference colour with deduplication
  function generateSimilarColours(
    referenceColour,
    inputColours,
    targetContrast
  ) {
    // Convert to HSL for easier manipulation
    const baseColour = chroma(referenceColour);
    const baseHsl = baseColour.hsl();

    // Handle NaN in hue (happens with greys)
    const h = isNaN(baseHsl[0]) ? 0 : baseHsl[0];
    const s = baseHsl[1];
    const l = baseHsl[2];

    // Use a Set to track unique colours (by their hex values)
    const similarColoursSet = new Set();
    const similarColours = [];

    // Generate variations by adjusting lightness and saturation
    // Lightness variations (both lighter and darker)
    for (let lDelta = -0.4; lDelta <= 0.4; lDelta += 0.02) {
      // Skip if out of bounds
      if (l + lDelta < 0 || l + lDelta > 1) continue;

      // Small saturation variations
      for (let sDelta = -0.2; sDelta <= 0.2; sDelta += 0.1) {
        if (s + sDelta < 0 || s + sDelta > 1) continue;

        // For greys, add small hue variations to create slightly coloured greys
        const hueVariations = s < 0.1 ? [0, 30, 60, 120, 180, 240, 300] : [h];

        for (const currentH of hueVariations) {
          try {
            const newColour = chroma(
              currentH,
              s + sDelta,
              l + lDelta,
              "hsl"
            ).hex();

            // Skip if this exact colour has already been added
            if (similarColoursSet.has(newColour.toLowerCase())) {
              continue;
            }

            // Check contrast with all input colours
            let allPass = true;
            const contrastValues = [];

            for (const colour of inputColours) {
              const contrast = getContrast(newColour, colour);
              contrastValues.push(contrast);
              if (contrast < targetContrast) {
                allPass = false;
                break;
              }
            }

            // Only add if it passes contrast check with all input colours
            if (allPass) {
              // Add to tracking set
              similarColoursSet.add(newColour.toLowerCase());

              // Add to results array
              similarColours.push({
                colour: newColour,
                minContrast: Math.min(...contrastValues),
                avgContrast:
                  contrastValues.reduce((a, b) => a + b, 0) /
                  contrastValues.length,
              });
            }
          } catch (e) {
            // Skip invalid colours
            console.error("Error creating colour:", e);
          }
        }
      }
    }

    // Sort by similarity to reference colour, then by contrast
    return similarColours.sort((a, b) => {
      // Calculate colour distance
      const distA = chroma.distance(a.colour, referenceColour);
      const distB = chroma.distance(b.colour, referenceColour);

      // Primary sort by distance (similarity)
      return distA - distB;
    });
  }

  // Display similar colours with pagination
  function displaySimilarColours(
    colours,
    referenceColour,
    inputColours,
    page = 1
  ) {
    const itemsPerPage = 20;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;

    // Sort colours by minContrast (lowest to highest)
    const sortedColours = [...colours].sort(
      (a, b) => a.minContrast - b.minContrast
    );

    const currentPageColours = sortedColours.slice(startIndex, endIndex);

    // Update heading
    similarColoursHeading.textContent = `Similar Colours to ${referenceColour.toUpperCase()} (${
      colours.length
    } found)`;

    // Clear previous display
    similarColoursGrid.innerHTML = "";

    // Display colours for current page
    currentPageColours.forEach((match) => {
      // Always include "More like this" button in the similar colours view too
      const card = createColourCard(match, inputColours, true);
      similarColoursGrid.appendChild(card);
    });

    // Update pagination
    updatePagination(colours.length, itemsPerPage, page);

    // Show the similar colours section
    similarColoursSection.classList.remove("hidden");
    resultsSection.classList.add("hidden");

    // Scroll to the top of the similar colours section
    similarColoursSection.scrollIntoView({ behavior: "smooth" });
  }

  // Update pagination controls
  function updatePagination(totalItems, itemsPerPage, currentPage) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    similarPagination.innerHTML = "";

    // Only show pagination if we have more than one page
    if (totalPages <= 1) {
      return;
    }

    // Add previous button
    if (currentPage > 1) {
      const prevBtn = document.createElement("button");
      prevBtn.textContent = "← Previous";
      prevBtn.addEventListener("click", function () {
        const newPage = currentPage - 1;
        // We're reusing the similarColours global variable here
        displaySimilarColours(
          similarColours,
          currentReferenceColour,
          currentInputColours,
          newPage
        );
      });
      similarPagination.appendChild(prevBtn);
    }

    // Add page indicator
    const pageIndicator = document.createElement("span");
    pageIndicator.textContent = `Page ${currentPage} of ${totalPages}`;
    pageIndicator.style.margin = "0 1rem";
    similarPagination.appendChild(pageIndicator);

    // Add next button
    if (currentPage < totalPages) {
      const nextBtn = document.createElement("button");
      nextBtn.textContent = "Next →";
      nextBtn.addEventListener("click", function () {
        const newPage = currentPage + 1;
        // We're reusing the similarColours global variable here
        displaySimilarColours(
          similarColours,
          currentReferenceColour,
          currentInputColours,
          newPage
        );
      });
      similarPagination.appendChild(nextBtn);
    }
  }

  // Create a colour card element
  function createColourCard(match, inputColours, includeMoreBtn = true) {
    const card = document.createElement("div");
    card.className = "colour-card";
    card.setAttribute("tabindex", "0");

    const swatch = document.createElement("div");
    swatch.className = "colour-swatch";
    swatch.style.backgroundColor = match.colour;

    const info = document.createElement("div");
    info.className = "colour-info";

    info.textContent = match.colour.toUpperCase();

    const minContrastInfo = document.createElement("div");
    minContrastInfo.textContent =
      "Min contrast: " + match.minContrast.toFixed(2);
    info.appendChild(minContrastInfo);

    // Determine if this is likely a dark or light colour
    const rgb = chroma(match.colour).rgb();
    const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    const colorType = brightness < 128 ? "Dark" : "Light";

    const colorTypeInfo = document.createElement("div");
    colorTypeInfo.textContent = colorType;
    colorTypeInfo.className = "color-type";
    info.appendChild(colorTypeInfo);

    // Action buttons container
    const actionButtons = document.createElement("div");
    actionButtons.className = "action-buttons";

    // Select button for all colours
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.setAttribute("aria-label", `Select colour ${match.colour}`);
    selectBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // Remove any previously selected class
      document.querySelectorAll(".colour-card.selected").forEach((el) => {
        el.classList.remove("selected");
      });

      // Add selected class to this card
      card.classList.add("selected");

      // Show contrast details
      showContrastDetails(match.colour, inputColours);
    });
    actionButtons.appendChild(selectBtn);

    // "More like this" button (optional)
    if (includeMoreBtn) {
      // Actually generate the similar colours to check if there are any
      const similarColoursForMatch = generateSimilarColours(
        match.colour,
        inputColours, // Use the input colours passed to this function
        currentTargetContrast
      );

      // Only add the button if there are actually similar colours available
      if (similarColoursForMatch.length > 0) {
        const moreBtn = document.createElement("button");
        moreBtn.textContent = "More like this";
        moreBtn.className = "similar-btn";
        moreBtn.setAttribute(
          "aria-label",
          `Show ${similarColoursForMatch.length} more colours like ${match.colour}`
        );
        moreBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          // Pass the pre-generated colours to avoid re-computing them
          showSimilarColours(match.colour, similarColoursForMatch);
        });
        actionButtons.appendChild(moreBtn);
      }
    }

    info.appendChild(actionButtons);
    card.appendChild(swatch);
    card.appendChild(info);

    return card;
  }

  // Global variables for similar colours functionality
  let similarColours = [];
  let currentReferenceColour = null;

  // Show similar colours for a selected colour
  function showSimilarColours(referenceColour, preGeneratedColours = null) {
    currentReferenceColour = referenceColour;

    // Use pre-generated colours if provided, otherwise generate them
    if (preGeneratedColours) {
      similarColours = preGeneratedColours;
    } else {
      // Generate similar colours
      similarColours = generateSimilarColours(
        referenceColour,
        currentInputColours,
        currentTargetContrast
      );
    }

    // Only proceed if we have colours to show
    if (similarColours.length > 0) {
      // Display the similar colours with pagination
      displaySimilarColours(
        similarColours,
        referenceColour,
        currentInputColours
      );
    } else {
      console.log(
        `[showSimilarColours] No similar colours found for ${referenceColour}`
      );
      // No need for an alert as the button won't be shown if there are no similar colours
    }
  }

  function displayGroupedMatches(groupedMatches, inputColours) {
    resultsSection.classList.remove("hidden");
    colourGroups.innerHTML = "";

    // Count total matches
    let totalMatches = 0;
    Object.values(groupedMatches).forEach((group) => {
      totalMatches += group.length;
    });

    if (totalMatches === 0) {
      resultHeading.textContent = "No matching colours found";
      return;
    }

    resultHeading.textContent = `Matching Colours (${totalMatches} found)`;

    // Create table of contents
    const toc = document.createElement("div");
    toc.className = "toc";

    const tocTitle = document.createElement("div");
    tocTitle.className = "toc-title";
    tocTitle.textContent = "Jump to colour group:";
    toc.appendChild(tocTitle);

    const tocList = document.createElement("div");
    tocList.className = "toc-list";

    // Keep track of active groups to only include those in the TOC
    const activeGroups = [];

    // First scan to find active groups
    Object.keys(groupedMatches).forEach((groupKey) => {
      if (groupedMatches[groupKey].length > 0) {
        activeGroups.push(groupKey);
      }
    });

    // Create TOC items for active groups
    activeGroups.forEach((groupKey) => {
      const group = groupedMatches[groupKey];

      const tocItem = document.createElement("a");
      tocItem.className = "toc-item";
      tocItem.href = `#colour-group-${groupKey}`;

      const tocSwatch = document.createElement("span");
      tocSwatch.className = "toc-swatch";
      tocSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      tocItem.appendChild(tocSwatch);
      tocItem.appendChild(
        document.createTextNode(
          `${colourCategoryDefinitions[groupKey].name} (${group.length})`
        )
      );

      tocList.appendChild(tocItem);
    });

    toc.appendChild(tocList);
    colourGroups.appendChild(toc);

    // Create a section for each group
    activeGroups.forEach((groupKey) => {
      // Sort the group by minContrast (lowest to highest)
      const unsortedGroup = groupedMatches[groupKey];
      const group = [...unsortedGroup].sort(
        (a, b) => a.minContrast - b.minContrast
      );

      const groupContainer = document.createElement("div");
      groupContainer.className = "colour-group";
      groupContainer.id = `colour-group-${groupKey}`;

      // Create group heading with sample swatch
      const groupHeadingDiv = document.createElement("div");
      groupHeadingDiv.className = "group-heading";

      const groupSwatch = document.createElement("div");
      groupSwatch.className = "group-swatch";
      groupSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      const groupHeading = document.createElement("h3");
      groupHeading.textContent = `${colourCategoryDefinitions[groupKey].name} (${group.length})`;

      groupHeadingDiv.appendChild(groupSwatch);
      groupHeadingDiv.appendChild(groupHeading);
      groupContainer.appendChild(groupHeadingDiv);

      // Show a preview row of 3 colours
      if (group.length >= 3) {
        const previewRow = document.createElement("div");
        previewRow.className = "colour-preview-row";

        for (let i = 0; i < Math.min(3, group.length); i++) {
          const previewSwatch = document.createElement("div");
          previewSwatch.className = "preview-swatch";
          previewSwatch.style.backgroundColor = group[i].colour;
          previewSwatch.setAttribute("role", "img"); // Add this line to set the role to img
          previewSwatch.setAttribute(
            "aria-label",
            `Preview of colour ${group[i].colour}`
          );
          previewRow.appendChild(previewSwatch);
        }

        groupContainer.appendChild(previewRow);
      }

      // Create a grid wrapper div for this group's colours
      const groupGridWrapper = document.createElement("div");
      groupGridWrapper.className = "group-grid-wrapper";

      // Create a grid for this group's colours
      const groupGrid = document.createElement("div");
      groupGrid.className = "matching-colours";

      // Show top 6 colours per group initially
      const initialDisplay = group.slice(0, 6);
      initialDisplay.forEach((match) => {
        const card = createColourCard(match, inputColours);
        groupGrid.appendChild(card);
      });

      groupGridWrapper.appendChild(groupGrid);
      groupContainer.appendChild(groupGridWrapper);

      // Add "show more" button if there are more than 6 colours
      if (group.length > 6) {
        const showMoreBtn = document.createElement("button");
        showMoreBtn.textContent = `Show all ${
          group.length
        } ${colourCategoryDefinitions[groupKey].name.toLowerCase()}`;
        showMoreBtn.style.marginTop = "1rem";

        showMoreBtn.addEventListener("click", function () {
          // Remove the initial 6 colours
          groupGrid.innerHTML = "";

          // Add all colours in this group
          group.forEach((match) => {
            const card = createColourCard(match, inputColours);
            groupGrid.appendChild(card);
          });

          // Remove the show more button
          this.remove();
        });

        groupContainer.appendChild(showMoreBtn);
      }

      // Add "Back to matching colour groups" link
      const backToGroupsLink = document.createElement("a");
      backToGroupsLink.href = "#result-heading";
      backToGroupsLink.textContent = "Back to matching colour groups";
      backToGroupsLink.className = "back-to-groups-link";

      // Add event listener to manage focus for keyboard users
      backToGroupsLink.addEventListener("click", function (e) {
        e.preventDefault();

        // Scroll to results heading
        document
          .getElementById("result-heading")
          .scrollIntoView({ behavior: "smooth" });

        // Set focus to results heading after scrolling completes
        setTimeout(function () {
          document
            .getElementById("result-heading")
            .setAttribute("tabindex", "-1");
          document.getElementById("result-heading").focus();
        }, 500);
      });

      groupContainer.appendChild(backToGroupsLink);

      colourGroups.appendChild(groupContainer);
    });

    // Add click behavior for TOC items
    document.querySelectorAll(".toc-item").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();

        // Remove active class from all items
        document.querySelectorAll(".toc-item").forEach((i) => {
          i.classList.remove("active");
        });

        // Add active class to clicked item
        this.classList.add("active");

        // Scroll to the target group
        const targetId = this.getAttribute("href").substring(1);
        document.getElementById(targetId).scrollIntoView({
          behavior: "smooth",
        });
      });
    });
  }

  // Show contrast details for a selected colour
  function showContrastDetails(selectedColour, inputColours) {
    // Make sure contrast details section is visible
    contrastDetails.classList.remove("hidden");
    contrastPairs.innerHTML = "";

    // Create a heading showing the selected colour
    const selectedHeading = document.createElement("div");
    selectedHeading.className = "selected-colour-heading";
    selectedHeading.innerHTML = `<h3>Selected Colour: ${selectedColour.toUpperCase()}</h3>`;

    // Create a swatch for the selected colour
    const selectedSwatch = document.createElement("div");
    selectedSwatch.className = "selected-colour-swatch";
    selectedSwatch.style.backgroundColor = selectedColour;

    selectedHeading.appendChild(selectedSwatch);
    contrastPairs.appendChild(selectedHeading);

    // Add a separator
    const separator = document.createElement("hr");
    separator.className = "details-separator";
    contrastPairs.appendChild(separator);

    // Add a heading for the contrast pairs
    const pairsHeading = document.createElement("h3");
    pairsHeading.textContent = "Contrast Details With Your Colours:";
    pairsHeading.className = "pairs-heading";
    contrastPairs.appendChild(pairsHeading);

    // Calculate and display contrast for each input colour
    inputColours.forEach((colour, index) => {
      const contrastRatio = getContrast(selectedColour, colour);
      const targetContrast = currentTargetContrast;

      const pairDiv = document.createElement("div");
      pairDiv.className = "contrast-pair";

      const swatchesDiv = document.createElement("div");
      swatchesDiv.className = "contrast-swatches";

      const inputSwatch = document.createElement("div");
      inputSwatch.className = "sample-swatch";
      inputSwatch.style.backgroundColor = colour;
      inputSwatch.setAttribute(
        "aria-label",
        `Input colour ${index + 1}: ${colour}`
      );

      const selectedSwatchCopy = document.createElement("div");
      selectedSwatchCopy.className = "sample-swatch";
      selectedSwatchCopy.style.backgroundColor = selectedColour;
      selectedSwatchCopy.setAttribute(
        "aria-label",
        `Selected colour: ${selectedColour}`
      );

      swatchesDiv.appendChild(inputSwatch);
      swatchesDiv.appendChild(selectedSwatchCopy);

      const infoDiv = document.createElement("div");
      infoDiv.className = "contrast-info";

      const inputColourLabel = document.createElement("div");
      inputColourLabel.className = "input-colour-label";
      inputColourLabel.innerHTML = `Input colour ${
        index + 1
      }:<strong> ${colour}</strong>`;

      const ratioText = document.createElement("div");
      ratioText.innerHTML = `Contrast ratio: <strong>${contrastRatio.toFixed(
        2
      )}:1</strong>`;

      const passClass =
        contrastRatio >= targetContrast ? "contrast-pass" : "contrast-fail";
      const passText = document.createElement("div");
      passText.className = passClass;
      passText.textContent =
        contrastRatio >= targetContrast ? "✓ PASS" : "✗ FAIL";

      infoDiv.appendChild(inputColourLabel);
      infoDiv.appendChild(ratioText);
      infoDiv.appendChild(passText);

      // Add appropriate examples based on the selected contrast level
      if (targetContrast === 3) {
        // For 3:1 contrast, show UI component examples instead of text
        const svgExamples = document.createElement("div");
        svgExamples.style.marginTop = "1rem";

        // Create SVG examples - using selectedColour as background and input colour as foreground
        svgExamples.innerHTML = `
    <p>UI Component Examples (3:1 contrast):</p>
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
        <!-- Document/File Icon Example -->
        <div style="text-align: center;">
            <div class="pairExample" style="background-color: ${selectedColour}; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <svg width="100" height="60" aria-label="Document icon example" viewBox="0 0 24 24">
                    <path d="M14 2H6C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H18C19.11 22 20 21.11 20 20V8L14 2Z" 
                        fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M14 2V8H20" 
                        fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9 13H15" 
                        fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                    <path d="M9 17H15" 
                        fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                </svg>
            </div>
            <p style="font-size: 0.8rem; margin-top: 0.3rem;">Document Icon</p>
        </div>
        
        <!-- Settings/Gear Icon Example -->
        <div style="text-align: center;">
            <div class="pairExample" style="background-color: ${selectedColour}; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <svg width="100" height="60" aria-label="Settings icon example" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="3" 
                        fill="none" stroke="${colour}" stroke-width="1.5"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" 
                        fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <p style="font-size: 0.8rem; margin-top: 0.3rem;">Settings Icon</p>
        </div>
        
        <!-- Search/Magnifying Glass Icon Example -->
        <div style="text-align: center;">
            <div class="pairExample" style="background-color: ${selectedColour}; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <svg width="100" height="60" aria-label="Search icon example" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8" 
                        fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M21 21L16.65 16.65" 
                        fill="none" stroke="${colour}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <p style="font-size: 0.8rem; margin-top: 0.3rem;">Search Icon</p>
        </div>
    </div>
    <p style="margin-top: 0.5rem; font-size: 0.9rem;">
        Note: 3:1 minimum contrast is suitable for graphical objects and UI components 
        without text, but not sufficient for text content. Each example demonstrates 
        the contrast between your input colour and the selected background colour.
    </p>
`;

        infoDiv.appendChild(svgExamples);
      } else {
        // For 4.5:1 and 7:1 contrast, show text examples as before
        const textSample = document.createElement("div");
        textSample.className = "text-sample";
        textSample.style.color = selectedColour;
        textSample.style.backgroundColor = colour;
        textSample.textContent = "Text on background colour";

        const bgSample = document.createElement("div");
        bgSample.className = "text-sample";
        bgSample.style.color = colour;
        bgSample.style.backgroundColor = selectedColour;
        bgSample.textContent = "Background on text colour";

        infoDiv.appendChild(textSample);
        infoDiv.appendChild(bgSample);

        // Add note for different contrast levels
        const contrastNote = document.createElement("p");
        contrastNote.style.fontSize = "0.9rem";
        contrastNote.style.marginTop = "0.5rem";

        if (targetContrast === 4.5) {
          contrastNote.textContent =
            "Regular text must achieve a 4.5:1 minimum contrast ratio to meet WCAG Success Criterion 1.4.3: Contrast (Minimum) (Level AA).";
        } else if (targetContrast === 7) {
          contrastNote.textContent =
            "Regular text must achieve a 7:1 minimum contrast ratio to meet WCAG Success Criterion 1.4.6: Contrast (Enhanced) (Level AAA).";
        }

        infoDiv.appendChild(contrastNote);
      }

      pairDiv.appendChild(swatchesDiv);
      pairDiv.appendChild(infoDiv);

      contrastPairs.appendChild(pairDiv);
    });

    // Scroll to the contrast details section
    contrastDetails.scrollIntoView({ behavior: "smooth" });
  }

  // Handle form submission
  // Update the form submission handler to handle partial matches
  form.addEventListener("submit", function (e) {
    e.preventDefault();

    // Clear previous results
    errorMessage.style.display = "none";
    resultsSection.classList.remove("hidden");
    similarColoursSection.classList.add("hidden");
    contrastDetails.classList.add("hidden");

    // Reset sections
    colourGroups.innerHTML = "";

    // Scroll to the results heading
    setTimeout(() => {
      resultHeading.scrollIntoView();
    }, 150); // Small delay to ensure the section is visible first

    // Array to store valid colours
    const validColours = [];
    const invalidColours = [];

    // Process colours based on active input method
    if (activeInputMethod === "manual-input") {
      // Get and validate colours from text input
      const rawInput = colourInput.value.trim();
      if (!rawInput) {
        colourInput.setAttribute("required", "required");
        errorMessage.textContent = "Please enter at least one colour.";
        errorMessage.style.display = "block";
        return;
      }

      const parsedColours = parseColours(rawInput);

      parsedColours.forEach((colour) => {
        if (isValidHexColour(colour)) {
          validColours.push(normalizeColour(colour));
        } else if (colour !== "") {
          invalidColours.push(colour);
        }
      });

      if (invalidColours.length > 0) {
        errorMessage.textContent = `Invalid colour format: ${invalidColours.join(
          ", "
        )}. Please use 6-character hex codes.`;
        errorMessage.style.display = "block";
        return;
      }
    } else if (activeInputMethod === "file-input") {
      // Use colours loaded from file
      if (loadedColours.length === 0) {
        errorMessage.textContent = "Please upload a file with valid colours.";
        errorMessage.style.display = "block";
        return;
      }

      // Copy loaded colours to valid colours
      validColours.push(...loadedColours);
    }

    if (validColours.length === 0) {
      errorMessage.textContent = "Please enter at least one valid colour.";
      errorMessage.style.display = "block";
      return;
    }

    if (validColours.length === 1) {
      // Special message for single colour input
      resultHeading.textContent =
        "Please enter at least two colours to find contrast matches";
      return;
    }

    // Store current input colours for later use (similar colours generation)
    currentInputColours = validColours;

    // Get target contrast
    currentTargetContrast = parseFloat(
      document.querySelector('input[name="contrast-level"]:checked').value
    );

    // Find matching colours
    const result = findMatchingColours(validColours, currentTargetContrast);

    // Handle based on match type
    if (result.fullMatches.length > 0) {
      // We have full matches - process as before
      originalMatchingColours = result.fullMatches;

      // Group matches by colour category
      const groupedMatches = groupMatchingColours(result.fullMatches);

      // Display grouped results
      displayGroupedMatches(groupedMatches, validColours);
    } else if (result.partialMatches && result.bestPartialSize > 0) {
      // Show partial matches
      originalMatchingColours = result.partialMatches;
      displayPartialMatches(
        result.partialMatches,
        validColours,
        result.bestPartialSize
      );
    } else {
      // No matches found at all
      resultHeading.textContent = "No matching colours found";

      // Add helpful suggestion
      const noMatchHelp = document.createElement("div");
      noMatchHelp.className = "no-match-help";
      noMatchHelp.innerHTML = `
      <p>No colours were found that meet the ${currentTargetContrast}:1 contrast requirement with your input colours.</p>
      <p>Consider:</p>
      <ul>
        <li>Reducing the contrast requirement (if appropriate for your use case)</li>
        <li>Removing some colours from your palette that may be causing contrast issues</li>
        <li>Using different colour combinations for different elements</li>
      </ul>
    `;
      colourGroups.appendChild(noMatchHelp);
    }
  });

  // New function to display partial matches
  function displayPartialMatches(partialMatches, allInputColours, matchSize) {
    // Update heading to indicate partial matches
    resultHeading.textContent = `Partial Matches (${partialMatches.length} found)`;

    // Create explanation banner
    const explanationBanner = document.createElement("div");
    explanationBanner.className = "partial-match-banner";
    explanationBanner.innerHTML = `
    <p><strong>Note:</strong> We couldn't find any colours that meet the ${currentTargetContrast}:1 contrast 
    target for all of your input colours.</p>
    <p>Here are colours that have sufficient contrast with <strong> ${matchSize} out of ${allInputColours.length} 
    </strong> of your input colours.</p>
  `;
    colourGroups.appendChild(explanationBanner);

    // Group matches by colour category as with full matches
    const groupedMatches = groupMatchingColours(partialMatches);

    // Create table of contents
    const toc = document.createElement("div");
    toc.className = "toc";

    const tocTitle = document.createElement("div");
    tocTitle.className = "toc-title";
    tocTitle.textContent = "Jump to colour group:";
    toc.appendChild(tocTitle);

    const tocList = document.createElement("div");
    tocList.className = "toc-list";

    // Keep track of active groups
    const activeGroups = [];
    Object.keys(groupedMatches).forEach((groupKey) => {
      if (groupedMatches[groupKey].length > 0) {
        activeGroups.push(groupKey);
      }
    });

    // Create TOC items for active groups
    activeGroups.forEach((groupKey) => {
      const group = groupedMatches[groupKey];

      const tocItem = document.createElement("a");
      tocItem.className = "toc-item";
      tocItem.href = `#colour-group-${groupKey}`;

      const tocSwatch = document.createElement("span");
      tocSwatch.className = "toc-swatch";
      tocSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      tocItem.appendChild(tocSwatch);
      tocItem.appendChild(
        document.createTextNode(
          `${colourCategoryDefinitions[groupKey].name} (${group.length})`
        )
      );

      tocList.appendChild(tocItem);
    });

    toc.appendChild(tocList);
    colourGroups.appendChild(toc);

    // Create a section for each group
    activeGroups.forEach((groupKey) => {
      // Sort the group by minContrast (lowest to highest)
      const unsortedGroup = groupedMatches[groupKey];
      const group = [...unsortedGroup].sort(
        (a, b) => a.minContrast - b.minContrast
      );

      const groupContainer = document.createElement("div");
      groupContainer.className = "colour-group";
      groupContainer.id = `colour-group-${groupKey}`;

      // Create group heading with sample swatch
      const groupHeadingDiv = document.createElement("div");
      groupHeadingDiv.className = "group-heading";

      const groupSwatch = document.createElement("div");
      groupSwatch.className = "group-swatch";
      groupSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      const groupHeading = document.createElement("h3");
      groupHeading.textContent = `${colourCategoryDefinitions[groupKey].name} (${group.length})`;

      groupHeadingDiv.appendChild(groupSwatch);
      groupHeadingDiv.appendChild(groupHeading);
      groupContainer.appendChild(groupHeadingDiv);

      // Show a preview row of 3 colours
      if (group.length >= 3) {
        const previewRow = document.createElement("div");
        previewRow.className = "colour-preview-row";

        // Show first 3 colours as a preview
        for (let i = 0; i < Math.min(3, group.length); i++) {
          const previewSwatch = document.createElement("div");
          previewSwatch.className = "preview-swatch";
          previewSwatch.setAttribute("role", "img");
          previewSwatch.style.backgroundColor = group[i].colour;
          previewSwatch.setAttribute(
            "aria-label",
            `Preview of colour ${group[i].colour}`
          );
          previewRow.appendChild(previewSwatch);
        }

        groupContainer.appendChild(previewRow);
      }

      // Create a grid wrapper div for this group's colours
      const groupGridWrapper = document.createElement("div");
      groupGridWrapper.className = "group-grid-wrapper";

      // Create a grid for this group's colours
      const groupGrid = document.createElement("div");
      groupGrid.className = "matching-colours";

      // Show top 6 colours per group initially
      const initialDisplay = group.slice(0, 6);
      initialDisplay.forEach((match) => {
        // Create a modified colour card that shows which colours pass/fail
        const card = createPartialMatchCard(match, allInputColours);
        groupGrid.appendChild(card);
      });

      groupGridWrapper.appendChild(groupGrid);
      groupContainer.appendChild(groupGridWrapper);

      // Add "show more" button if there are more than 6 colours
      if (group.length > 6) {
        const showMoreBtn = document.createElement("button");
        showMoreBtn.textContent = `Show all ${
          group.length
        } ${colourCategoryDefinitions[groupKey].name.toLowerCase()}`;
        showMoreBtn.style.marginTop = "1rem";

        showMoreBtn.addEventListener("click", function () {
          // Remove the initial 6 colours
          groupGrid.innerHTML = "";

          // Add all colours in this group
          group.forEach((match) => {
            const card = createColourCard(match, inputColours);
            groupGrid.appendChild(card);
          });

          // Remove the show more button
          this.remove();
        });

        groupContainer.appendChild(showMoreBtn);
      }

      // Add "Back to matching colour groups" link
      const backToGroupsLink = document.createElement("a");
      backToGroupsLink.href = "#result-heading";
      backToGroupsLink.textContent = "Back to matching colour groups";
      backToGroupsLink.className = "back-to-groups-link";

      // Add event listener to manage focus for keyboard users
      backToGroupsLink.addEventListener("click", function (e) {
        e.preventDefault();

        // Scroll to results heading
        document
          .getElementById("result-heading")
          .scrollIntoView({ behavior: "smooth" });

        // Set focus to results heading after scrolling completes
        setTimeout(function () {
          document
            .getElementById("result-heading")
            .setAttribute("tabindex", "-1");
          document.getElementById("result-heading").focus();
        }, 500);
      });

      groupContainer.appendChild(backToGroupsLink);

      colourGroups.appendChild(groupContainer);
    });

    // Add click behavior for TOC items
    document.querySelectorAll(".toc-item").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();

        // Remove active class from all items
        document.querySelectorAll(".toc-item").forEach((i) => {
          i.classList.remove("active");
        });

        // Add active class to clicked item
        this.classList.add("active");

        // Scroll to the target group
        const targetId = this.getAttribute("href").substring(1);
        document.getElementById(targetId).scrollIntoView({
          behavior: "smooth",
        });
      });
    });
  }

  // Create a card for partial matches that shows which colours pass/fail
  function createPartialMatchCard(match, allInputColours) {
    const card = document.createElement("div");
    card.className = "colour-card";
    card.setAttribute("tabindex", "0");

    const swatch = document.createElement("div");
    swatch.className = "colour-swatch";
    swatch.style.backgroundColor = match.colour;

    const info = document.createElement("div");
    info.className = "colour-info";
    info.textContent = match.colour.toUpperCase();

    const minContrastInfo = document.createElement("div");
    minContrastInfo.textContent =
      "Min contrast: " + match.minContrast.toFixed(2);
    info.appendChild(minContrastInfo);

    // Add match summary info
    const matchSummary = document.createElement("div");
    matchSummary.className = "match-summary";
    matchSummary.textContent = `Passes ${match.passingColours.length}/${allInputColours.length} colours`;
    info.appendChild(matchSummary);

    // Determine if this is likely a dark or light colour
    const rgb = chroma(match.colour).rgb();
    const brightness = (rgb[0] * 299 + rgb[1] * 587 + rgb[2] * 114) / 1000;
    const colorType = brightness < 128 ? "Dark" : "Light";

    const colorTypeInfo = document.createElement("div");
    colorTypeInfo.textContent = colorType;
    colorTypeInfo.className = "color-type";
    info.appendChild(colorTypeInfo);

    // Action buttons container - THIS LINE WAS MISSING
    const actionButtons = document.createElement("div");
    actionButtons.className = "action-buttons";

    // Select button for all colours
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.setAttribute("aria-label", `Select colour ${match.colour}`);
    selectBtn.addEventListener("click", function (e) {
      e.stopPropagation();

      // Remove any previously selected class
      document.querySelectorAll(".colour-card.selected").forEach((el) => {
        el.classList.remove("selected");
      });

      // Add selected class to this card
      card.classList.add("selected");

      // Show contrast details, using a modified version that highlights passing/failing
      showPartialContrastDetails(
        match.colour,
        allInputColours,
        match.passingColours,
        match.failingColours
      );
    });
    actionButtons.appendChild(selectBtn);

    // Actually generate the similar colours to check if there are any
    const similarColoursForMatch = generateSimilarColours(
      match.colour,
      match.passingColours, // Use passing colours for partial matches
      currentTargetContrast
    );

    // Only add the button if there are actually similar colours available
    if (similarColoursForMatch.length > 0) {
      const moreBtn = document.createElement("button");
      moreBtn.textContent = "More like this";
      moreBtn.className = "similar-btn";
      moreBtn.setAttribute(
        "aria-label",
        `Show ${similarColoursForMatch.length} more colours like ${match.colour}`
      );
      moreBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        // Pass the pre-generated colours to avoid re-computing them
        showSimilarColours(match.colour, similarColoursForMatch);
      });
      actionButtons.appendChild(moreBtn);
    }

    info.appendChild(actionButtons);
    card.appendChild(swatch);
    card.appendChild(info);

    return card;
  }

  // Show contrast details for partial matches
  function showPartialContrastDetails(
    selectedColour,
    allInputColours,
    passingColours,
    failingColours
  ) {
    // Make sure contrast details section is visible
    contrastDetails.classList.remove("hidden");
    contrastPairs.innerHTML = "";

    // Create a heading showing the selected colour
    const selectedHeading = document.createElement("div");
    selectedHeading.className = "selected-colour-heading";
    selectedHeading.innerHTML = `<h3>Selected Colour: ${selectedColour.toUpperCase()}</h3>`;

    // Create a swatch for the selected colour
    const selectedSwatch = document.createElement("div");
    selectedSwatch.className = "selected-colour-swatch";
    selectedSwatch.style.backgroundColor = selectedColour;

    selectedHeading.appendChild(selectedSwatch);
    contrastPairs.appendChild(selectedHeading);

    // Add partial match summary
    const partialSummary = document.createElement("div");
    partialSummary.className = "partial-summary";
    partialSummary.innerHTML = `
    <p>This colour has sufficient contrast with <strong> ${passingColours.length} out of ${allInputColours.length} </strong> input colours.</p>
  `;
    contrastPairs.appendChild(partialSummary);

    // Add a separator
    const separator = document.createElement("hr");
    separator.className = "details-separator";
    contrastPairs.appendChild(separator);

    // Add a heading for the contrast pairs
    const pairsHeading = document.createElement("h3");
    pairsHeading.textContent = "Contrast Details With Your Colours:";
    pairsHeading.className = "pairs-heading";
    contrastPairs.appendChild(pairsHeading);

    // Calculate and display contrast for each input colour
    allInputColours.forEach((colour, index) => {
      const contrastRatio = getContrast(selectedColour, colour);
      const targetContrast = currentTargetContrast;
      const isPassing = contrastRatio >= targetContrast;

      const pairDiv = document.createElement("div");
      pairDiv.className = "contrast-pair";
      // Add a visual indication if it's passing or failing
      if (isPassing) {
        pairDiv.classList.add("passing-pair");
      } else {
        pairDiv.classList.add("failing-pair");
      }

      const swatchesDiv = document.createElement("div");
      swatchesDiv.className = "contrast-swatches";

      const inputSwatch = document.createElement("div");
      inputSwatch.className = "sample-swatch";
      inputSwatch.style.backgroundColor = colour;
      inputSwatch.setAttribute(
        "aria-label",
        `Input colour ${index + 1}: ${colour}`
      );

      const selectedSwatchCopy = document.createElement("div");
      selectedSwatchCopy.className = "sample-swatch";
      selectedSwatchCopy.style.backgroundColor = selectedColour;
      selectedSwatchCopy.setAttribute(
        "aria-label",
        `Selected colour: ${selectedColour}`
      );

      swatchesDiv.appendChild(inputSwatch);
      swatchesDiv.appendChild(selectedSwatchCopy);

      const infoDiv = document.createElement("div");
      infoDiv.className = "contrast-info";

      const inputColourLabel = document.createElement("div");
      inputColourLabel.className = "input-colour-label";
      inputColourLabel.innerHTML = `Input colour ${
        index + 1
      }:<strong>${colour}</strong> `;

      const ratioText = document.createElement("div");
      ratioText.innerHTML = `Contrast ratio: <strong>${contrastRatio.toFixed(
        2
      )}:1</strong>`;

      const passClass =
        contrastRatio >= targetContrast ? "contrast-pass" : "contrast-fail";
      const passText = document.createElement("div");
      passText.className = passClass;
      passText.textContent =
        contrastRatio >= targetContrast ? "✓ PASS" : "✗ FAIL";

      infoDiv.appendChild(inputColourLabel);
      infoDiv.appendChild(ratioText);
      infoDiv.appendChild(passText);

      // Add UI components or text examples based on contrast target
      if (targetContrast === 3) {
        // UI component examples for 3:1 contrast
        const svgExamples = document.createElement("div");
        svgExamples.style.marginTop = "1rem";
        svgExamples.innerHTML = `
        <p>UI Component Examples (3:1 contrast):</p>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
            <!-- Document/File Icon Example -->
            <div style="text-align: center;">
                <div class="pairExample" style="background-color: ${selectedColour}; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <svg width="100" height="60" aria-label="Document icon example" viewBox="0 0 24 24">
                        <path d="M14 2H6C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H18C19.11 22 20 21.11 20 20V8L14 2Z" 
                            fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" 
                            fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 13H15" 
                            fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M9 17H15" 
                            fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <p style="font-size: 0.8rem; margin-top: 0.3rem;">Document Icon</p>
            </div>
        </div>
      `;

        infoDiv.appendChild(svgExamples);
      } else {
        // Text examples for 4.5:1 and 7:1 contrast
        const textSample = document.createElement("div");
        textSample.className = "text-sample";
        textSample.style.color = selectedColour;
        textSample.style.backgroundColor = colour;
        textSample.textContent = "Text on background colour";

        const bgSample = document.createElement("div");
        bgSample.className = "text-sample";
        bgSample.style.color = colour;
        bgSample.style.backgroundColor = selectedColour;
        bgSample.textContent = "Background on text colour";

        infoDiv.appendChild(textSample);
        infoDiv.appendChild(bgSample);
      }

      // Add recommendation for failing pairs
      if (!isPassing) {
        const recommendation = document.createElement("div");
        recommendation.className = "contrast-recommendation";
        recommendation.innerHTML = `
        <p><strong>Recommendation:</strong> Use a different colour combination for elements using these colours.</p>
      `;
        infoDiv.appendChild(recommendation);
      }

      pairDiv.appendChild(swatchesDiv);
      pairDiv.appendChild(infoDiv);

      contrastPairs.appendChild(pairDiv);
    });

    // Scroll to the contrast details section
    contrastDetails.scrollIntoView({ behavior: "smooth" });
  }

  // New function to display partial matches
  function displayPartialMatches(partialMatches, allInputColours, matchSize) {
    // Update heading to indicate partial matches
    resultHeading.textContent = `Partial Matches (${partialMatches.length} found)`;

    // Create explanation banner
    const explanationBanner = document.createElement("div");
    explanationBanner.className = "partial-match-banner";
    explanationBanner.innerHTML = `
    <p><strong>Note:</strong> We couldn't find any colours that achieve the ${currentTargetContrast}:1 contrast 
    target for all of your input colours.</p>
    <p>Here are colours that have sufficient contrast with <strong> ${matchSize} out of ${allInputColours.length} 
    </strong> of your input colours.</p>
  `;
    colourGroups.appendChild(explanationBanner);

    // Group matches by colour category as with full matches
    const groupedMatches = groupMatchingColours(partialMatches);

    // Create table of contents
    const toc = document.createElement("div");
    toc.className = "toc";

    const tocTitle = document.createElement("div");
    tocTitle.className = "toc-title";
    tocTitle.textContent = "Jump to colour group:";
    toc.appendChild(tocTitle);

    const tocList = document.createElement("div");
    tocList.className = "toc-list";

    // Keep track of active groups
    const activeGroups = [];
    Object.keys(groupedMatches).forEach((groupKey) => {
      if (groupedMatches[groupKey].length > 0) {
        activeGroups.push(groupKey);
      }
    });

    // Create TOC items for active groups
    activeGroups.forEach((groupKey) => {
      const group = groupedMatches[groupKey];

      const tocItem = document.createElement("a");
      tocItem.className = "toc-item";
      tocItem.href = `#colour-group-${groupKey}`;

      const tocSwatch = document.createElement("span");
      tocSwatch.className = "toc-swatch";
      tocSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      tocItem.appendChild(tocSwatch);
      tocItem.appendChild(
        document.createTextNode(
          `${colourCategoryDefinitions[groupKey].name} (${group.length})`
        )
      );

      tocList.appendChild(tocItem);
    });

    toc.appendChild(tocList);
    colourGroups.appendChild(toc);

    // Create a section for each group
    activeGroups.forEach((groupKey) => {
      // Sort the group by minContrast (lowest to highest)
      const unsortedGroup = groupedMatches[groupKey];
      const group = [...unsortedGroup].sort(
        (a, b) => a.minContrast - b.minContrast
      );

      const groupContainer = document.createElement("div");
      groupContainer.className = "colour-group";
      groupContainer.id = `colour-group-${groupKey}`;

      // Create group heading with sample swatch
      const groupHeadingDiv = document.createElement("div");
      groupHeadingDiv.className = "group-heading";

      const groupSwatch = document.createElement("div");
      groupSwatch.className = "group-swatch";
      groupSwatch.style.backgroundColor =
        colourCategoryDefinitions[groupKey].sampleColor;

      const groupHeading = document.createElement("h3");
      groupHeading.textContent = `${colourCategoryDefinitions[groupKey].name} (${group.length})`;

      groupHeadingDiv.appendChild(groupSwatch);
      groupHeadingDiv.appendChild(groupHeading);
      groupContainer.appendChild(groupHeadingDiv);

      // Show a preview row of 3 colours
      if (group.length >= 3) {
        const previewRow = document.createElement("div");
        previewRow.className = "colour-preview-row";

        // Show first 3 colours as a preview
        for (let i = 0; i < Math.min(3, group.length); i++) {
          const previewSwatch = document.createElement("div");
          previewSwatch.className = "preview-swatch";
          previewSwatch.style.backgroundColor = group[i].colour;
          previewSwatch.setAttribute("role", "img"); // Add this line to set the role to img
          previewSwatch.setAttribute(
            "aria-label",
            `Preview of colour ${group[i].colour}`
          );
          previewRow.appendChild(previewSwatch);
        }

        groupContainer.appendChild(previewRow);
      }

      // Create a grid wrapper div for this group's colours
      const groupGridWrapper = document.createElement("div");
      groupGridWrapper.className = "group-grid-wrapper";

      // Create a grid for this group's colours
      const groupGrid = document.createElement("div");
      groupGrid.className = "matching-colours";

      // Show top 6 colours per group initially
      const initialDisplay = group.slice(0, 6);
      initialDisplay.forEach((match) => {
        // Create a modified colour card that shows which colours pass/fail
        const card = createPartialMatchCard(match, allInputColours);
        groupGrid.appendChild(card);
      });

      groupGridWrapper.appendChild(groupGrid);
      groupContainer.appendChild(groupGridWrapper);

      // Add "show more" button if there are more than 6 colours
      if (group.length > 6) {
        const showMoreBtn = document.createElement("button");
        showMoreBtn.textContent = `Show all ${
          group.length
        } ${colourCategoryDefinitions[groupKey].name.toLowerCase()}`;
        showMoreBtn.style.marginTop = "1rem";

        showMoreBtn.addEventListener("click", function () {
          // Remove the initial 6 colours
          groupGrid.innerHTML = "";

          // Add all colours in this group
          group.forEach((match) => {
            const card = createPartialMatchCard(match, allInputColours);
            groupGrid.appendChild(card);
          });

          // Remove the show more button
          this.remove();
        });

        groupContainer.appendChild(showMoreBtn);
      }

      colourGroups.appendChild(groupContainer);
    });

    // Add click behavior for TOC items
    document.querySelectorAll(".toc-item").forEach((item) => {
      item.addEventListener("click", function (e) {
        e.preventDefault();

        // Remove active class from all items
        document.querySelectorAll(".toc-item").forEach((i) => {
          i.classList.remove("active");
        });

        // Add active class to clicked item
        this.classList.add("active");

        // Scroll to the target group
        const targetId = this.getAttribute("href").substring(1);
        document.getElementById(targetId).scrollIntoView({
          behavior: "smooth",
        });
      });
    });
  }

  /**
   * Improved function to determine if similar colours can be found that meet contrast requirements
   * with all input colours.
   *
   * @param {string} referenceColour - The hex colour code to find similar colours for
   * @param {string[]} inputColours - Array of hex colour codes to check contrast against
   * @param {number} targetContrast - Minimum contrast ratio required
   * @returns {boolean} True if similar colours can likely be found, false otherwise
   */
  function canFindSimilarColours(
    referenceColour,
    inputColours,
    targetContrast
  ) {
    console.log(
      `[canFindSimilarColours] Starting analysis for reference: ${referenceColour}`
    );
    console.log(
      `[canFindSimilarColours] Input colours (${
        inputColours.length
      }): ${inputColours.join(", ")}`
    );
    console.log(`[canFindSimilarColours] Target contrast: ${targetContrast}`);

    // Check inputs
    if (!inputColours || inputColours.length === 0) {
      console.log("[canFindSimilarColours] No input colours, returning false");
      return false;
    }

    // If only checking against one colour, we can always find similar colours
    // (as long as the one colour isn't identical to the reference colour)
    if (
      inputColours.length === 1 &&
      inputColours[0].toLowerCase() !== referenceColour.toLowerCase()
    ) {
      console.log(
        "[canFindSimilarColours] Only one non-identical input colour, returning true"
      );
      return true;
    }

    try {
      // Convert to Lab colour space for more perceptually uniform variations
      const baseLab = chroma(referenceColour).lab();

      // Constants for our variation generation
      const L_VARIATIONS = [0, -10, 10, -20, 20]; // Lightness variations
      const A_VARIATIONS = [0, -10, 10]; // A-axis variations (red-green)
      const B_VARIATIONS = [0, -10, 10]; // B-axis variations (yellow-blue)

      // Get the base Lab values
      const baseL = baseLab[0];
      const baseA = baseLab[1];
      const baseB = baseLab[2];

      console.log(
        `[canFindSimilarColours] Reference colour Lab values: L=${baseL.toFixed(
          2
        )}, a=${baseA.toFixed(2)}, b=${baseB.toFixed(2)}`
      );

      // Track the best contrast result we've found
      let bestMinContrast = 0;
      let bestVariation = null;

      // For achromatic colours (greys), check more hue variations
      const isAchromatic = Math.abs(baseA) < 5 && Math.abs(baseB) < 5;

      // For very light or very dark colours, add more extreme variations
      const isVeryLight = baseL > 85;
      const isVeryDark = baseL < 15;

      console.log(
        `[canFindSimilarColours] Colour characteristics: ${
          isAchromatic ? "Achromatic" : "Chromatic"
        }, ${
          isVeryLight
            ? "Very Light"
            : isVeryDark
            ? "Very Dark"
            : "Medium Brightness"
        }`
      );

      // Build variations list based on colour characteristics
      const variations = [];

      // Create standard variations
      for (const lVar of L_VARIATIONS) {
        // Skip invalid lightness values
        const l = baseL + lVar;
        if (l < 0 || l > 100) continue;

        // For the original lightness, check all A/B variations
        if (lVar === 0) {
          for (const aVar of A_VARIATIONS) {
            for (const bVar of B_VARIATIONS) {
              variations.push([l, baseA + aVar, baseB + bVar]);
            }
          }
        } else {
          // For different lightness values, only check the original A/B
          variations.push([l, baseA, baseB]);

          // For achromatic colours, add some chroma at different lightness levels
          if (isAchromatic) {
            variations.push([l, 15, 0]); // Reddish
            variations.push([l, -15, 0]); // Greenish
            variations.push([l, 0, 15]); // Yellowish
            variations.push([l, 0, -15]); // Bluish
          }
        }
      }

      // Add more extreme variations for edge cases
      if (isVeryLight) {
        // Add darker variations
        for (let i = 30; i <= 60; i += 10) {
          variations.push([baseL - i, baseA, baseB]);
        }
      }

      if (isVeryDark) {
        // Add lighter variations
        for (let i = 30; i <= 60; i += 10) {
          variations.push([baseL + i, baseA, baseB]);
        }
      }

      console.log(
        `[canFindSimilarColours] Generated ${variations.length} variations to test`
      );

      // Check each variation
      let testedCount = 0;
      let validCount = 0;
      let closeMatches = 0;

      for (const [l, a, b] of variations) {
        try {
          testedCount++;

          // Create a colour from these Lab coordinates
          const testColour = chroma.lab(l, a, b).hex();
          validCount++;

          // Skip if this is the same as the reference colour
          if (testColour.toLowerCase() === referenceColour.toLowerCase()) {
            continue;
          }

          // Check contrast with all input colours
          let allPass = true;
          let minContrast = Infinity;
          let failedInputs = [];

          for (const colour of inputColours) {
            const contrast = chroma.contrast(testColour, colour);
            minContrast = Math.min(minContrast, contrast);

            if (contrast < targetContrast) {
              allPass = false;
              failedInputs.push({ colour, contrast });
            }
          }

          // Keep track of the best contrast we've found
          if (minContrast > bestMinContrast) {
            bestMinContrast = minContrast;
            bestVariation = {
              lab: [l, a, b],
              colour: testColour,
              minContrast: minContrast,
            };
          }

          // Track colours that are close to meeting the target
          if (minContrast >= targetContrast * 0.7) {
            closeMatches++;
          }

          // If any variation passes, we can find similar colours
          if (allPass) {
            console.log(
              `[canFindSimilarColours] Found a passing variation: ${testColour} with min contrast ${minContrast.toFixed(
                2
              )}`
            );
            return true;
          }
        } catch (e) {
          // Skip invalid colours
          continue;
        }
      }

      console.log(
        `[canFindSimilarColours] Testing summary: ${testedCount} variations tested, ${validCount} valid colours`
      );
      console.log(
        `[canFindSimilarColours] Best contrast found: ${bestMinContrast.toFixed(
          2
        )} (${((bestMinContrast / targetContrast) * 100).toFixed(
          1
        )}% of target ${targetContrast})`
      );
      console.log(
        `[canFindSimilarColours] Close matches (>70% of target): ${closeMatches}`
      );

      if (bestVariation) {
        console.log(
          `[canFindSimilarColours] Best variation: ${
            bestVariation.colour
          } with Lab(${bestVariation.lab.map((v) => v.toFixed(1)).join(", ")})`
        );
      }

      // If we found colours with at least 70% of target contrast,
      // it's worth looking for more similar colours
      if (bestMinContrast >= targetContrast * 0.7) {
        console.log(
          `[canFindSimilarColours] Returning true based on proximity to target contrast (${(
            (bestMinContrast / targetContrast) *
            100
          ).toFixed(1)}%)`
        );
        return true;
      }

      // If no variations passed, it's unlikely to find similar colours
      console.log(
        `[canFindSimilarColours] No suitable variations found, returning false`
      );
      return false;
    } catch (e) {
      // If there's an error, let's assume we can't find similar colours
      console.error("Error in canFindSimilarColours:", e);
      return false;
    }
  }

  // Show contrast details for partial matches
  function showPartialContrastDetails(
    selectedColour,
    allInputColours,
    passingColours,
    failingColours
  ) {
    // Make sure contrast details section is visible
    contrastDetails.classList.remove("hidden");
    contrastPairs.innerHTML = "";

    // Create a heading showing the selected colour
    const selectedHeading = document.createElement("div");
    selectedHeading.className = "selected-colour-heading";
    selectedHeading.innerHTML = `<h3>Selected Colour: ${selectedColour}</span></h3>`;

    // Create a swatch for the selected colour
    const selectedSwatch = document.createElement("div");
    selectedSwatch.className = "selected-colour-swatch";
    selectedSwatch.style.backgroundColor = selectedColour;

    selectedHeading.appendChild(selectedSwatch);
    contrastPairs.appendChild(selectedHeading);

    // Add partial match summary
    const partialSummary = document.createElement("div");
    partialSummary.className = "partial-summary";
    partialSummary.innerHTML = `
    <p>This colour has sufficient contrast with <strong> ${passingColours.length} out of ${allInputColours.length} </strong> input colours.</p>
  `;
    contrastPairs.appendChild(partialSummary);

    // Add a separator
    const separator = document.createElement("hr");
    separator.className = "details-separator";
    contrastPairs.appendChild(separator);

    // Add a heading for the contrast pairs
    const pairsHeading = document.createElement("h3");
    pairsHeading.textContent = "Contrast Details With Your Colours:";
    pairsHeading.className = "pairs-heading";
    contrastPairs.appendChild(pairsHeading);

    // Calculate and display contrast for each input colour
    allInputColours.forEach((colour, index) => {
      const contrastRatio = getContrast(selectedColour, colour);
      const targetContrast = currentTargetContrast;
      const isPassing = contrastRatio >= targetContrast;

      const pairDiv = document.createElement("div");
      pairDiv.className = "contrast-pair";
      // Add a visual indication if it's passing or failing
      if (isPassing) {
        pairDiv.classList.add("passing-pair");
      } else {
        pairDiv.classList.add("failing-pair");
      }

      const swatchesDiv = document.createElement("div");
      swatchesDiv.className = "contrast-swatches";

      const inputSwatch = document.createElement("div");
      inputSwatch.className = "sample-swatch";
      inputSwatch.style.backgroundColor = colour;

      const selectedSwatchCopy = document.createElement("div");
      selectedSwatchCopy.className = "sample-swatch";
      selectedSwatchCopy.style.backgroundColor = selectedColour;

      swatchesDiv.appendChild(inputSwatch);
      swatchesDiv.appendChild(selectedSwatchCopy);

      const infoDiv = document.createElement("div");
      infoDiv.className = "contrast-info";

      const inputColourLabel = document.createElement("div");
      inputColourLabel.className = "input-colour-label";
      inputColourLabel.innerHTML = `Input colour ${
        index + 1
      }:<strong> ${colour}</strong>`;

      const ratioText = document.createElement("div");
      ratioText.innerHTML = `Contrast ratio: <strong>${contrastRatio.toFixed(
        2
      )}:1</strong>`;

      const passClass =
        contrastRatio >= targetContrast ? "contrast-pass" : "contrast-fail";
      const passText = document.createElement("div");
      passText.className = passClass;
      passText.textContent =
        contrastRatio >= targetContrast ? "✓ PASS" : "✗ FAIL";

      infoDiv.appendChild(inputColourLabel);
      infoDiv.appendChild(ratioText);
      infoDiv.appendChild(passText);

      // Add UI components or text examples based on contrast target
      if (targetContrast === 3) {
        // UI component examples for 3:1 contrast
        const svgExamples = document.createElement("div");
        svgExamples.style.marginTop = "1rem";
        svgExamples.innerHTML = `
        <p>UI Component Examples (3:1 contrast):</p>
        <div style="display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 0.5rem;">
            <!-- Document/File Icon Example -->
            <div style="text-align: center;">
                <div class="pairExample" style="background-color: ${selectedColour}; padding: 10px; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <svg width="100" height="60" aria-label="Document icon example" viewBox="0 0 24 24">
                        <path d="M14 2H6C4.89 2 4 2.89 4 4V20C4 21.11 4.89 22 6 22H18C19.11 22 20 21.11 20 20V8L14 2Z" 
                            fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M14 2V8H20" 
                            fill="none" stroke="${colour}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                        <path d="M9 13H15" 
                            fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                        <path d="M9 17H15" 
                            fill="none" stroke="${colour}" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                </div>
                <p style="font-size: 0.8rem; margin-top: 0.3rem;">Document Icon</p>
            </div>
        </div>
      `;

        infoDiv.appendChild(svgExamples);
      } else {
        // Text examples for 4.5:1 and 7:1 contrast
        const textSample = document.createElement("div");
        textSample.className = "text-sample";
        textSample.style.color = selectedColour;
        textSample.style.backgroundColor = colour;
        textSample.textContent = "Text on background colour";

        const bgSample = document.createElement("div");
        bgSample.className = "text-sample";
        bgSample.style.color = colour;
        bgSample.style.backgroundColor = selectedColour;
        bgSample.textContent = "Background on text colour";

        infoDiv.appendChild(textSample);
        infoDiv.appendChild(bgSample);
      }

      // Add recommendation for failing pairs
      if (!isPassing) {
        const recommendation = document.createElement("div");
        recommendation.className = "contrast-recommendation";
        recommendation.innerHTML = `
        <p><strong>Recommendation:</strong> Use a different colour combination for elements using these colours.</p>
      `;
        infoDiv.appendChild(recommendation);
      }

      pairDiv.appendChild(swatchesDiv);
      pairDiv.appendChild(infoDiv);

      contrastPairs.appendChild(pairDiv);
    });

    // Scroll to the contrast details section
    contrastDetails.scrollIntoView({ behavior: "smooth" });
  }

  // Handle "Back to results" button
  backToResultsBtn.addEventListener("click", function () {
    // Hide similar colours section
    similarColoursSection.classList.add("hidden");

    // Show results section
    resultsSection.classList.remove("hidden");

    // Scroll to the results section
    resultsSection.scrollIntoView({ behavior: "smooth" });
  });
});
