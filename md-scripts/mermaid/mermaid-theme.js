/**
 * Mermaid Theme Management
 * Provides theme switching and custom theme support for Mermaid diagrams
 * with focus on digital accessibility and meeting WCAG 2.2 AA standards
 */
window.MermaidThemes = (function () {
  // Logging configuration
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  // Current logging level
  let currentLogLevel = DEFAULT_LOG_LEVEL;

  /**
   * Check if logging should occur based on current level
   * @param {number} level - Log level to check
   * @returns {boolean} True if logging should occur
   */
  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= currentLogLevel;
  }

  /**
   * Log error message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR)) {
      console.error(`[Mermaid Themes Error] ${message}`, ...args);
    }
  }

  /**
   * Log warning message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN)) {
      console.warn(`[Mermaid Themes Warning] ${message}`, ...args);
    }
  }

  /**
   * Log info message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO)) {
      console.log(`[Mermaid Themes Info] ${message}`, ...args);
    }
  }

  /**
   * Log debug message
   * @param {string} message - Message to log
   * @param {...any} args - Additional arguments
   */
  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(`[Mermaid Themes Debug] ${message}`, ...args);
    }
  }

  /**
   * Set the current logging level
   * @param {number} level - New logging level
   */
  function setLogLevel(level) {
    if (Object.values(LOG_LEVELS).includes(level)) {
      currentLogLevel = level;
      logInfo(
        `Logging level set to ${Object.keys(LOG_LEVELS).find(
          (key) => LOG_LEVELS[key] === level
        )}`
      );
    } else {
      logWarn(`Invalid log level: ${level}`);
    }
  }

  // Theme configuration
  const themeConfig = {
    // Default themes to use based on site theme
    defaultThemes: {
      light: "accessibleLight", // Default theme for light mode
      dark: "dark", // Default theme for dark mode
    },

    // Control which themes appear in the selector
    // Set to true to show in selector, false to hide
    visibleThemes: {
      // Built-in themes
      default: true,
      neutral: true,
      dark: true,
      forest: true,

      // Custom themes
      wcagLight: true,
      accessibleLight: true,
      accessibleDark: true,
      highContrastLight: true,
      highContrastDark: true,
      blueAccent: true, // Add your new theme here
    },
    modeVisibleThemes: {
      light: [
        "default",
        "neutral",
        "forest",
        "accessibleLight",
        "highContrastLight",
        "wcagLight",
      ],
      dark: ["dark", "accessibleDark", "highContrastDark"],
    },
  };

  // Built-in themes available in Mermaid
  const builtInThemes = [
    { id: "default", name: "Mermaid" },
    { id: "neutral", name: "Neutral" },
    { id: "dark", name: "Dark" },
    { id: "forest", name: "Forest" },
  ];

  // Define base colours for accessibility calculations
  const accessibleBaseColors = {
    darkMode: {
      canvasColor: "#1E1E1E",
      textColor: "#FFFFFF",
      accentColor: "#6082B6", // Proper blue for dark mode
    },
    lightMode: {
      canvasColor: "#FFFFFF",
      textColor: "#333333",
      accentColor: "#1E56A0", // Proper blue for light mode
    },
  };
  /**
   * Convert hex colour to RGB array
   * @param {string} hex - Hex colour code
   * @returns {Array} RGB values array [r, g, b]
   */
  function hexToRgb(hex) {
    // Remove # if present
    hex = hex.replace(/^#/, "");

    // Parse hex values
    let r, g, b;
    if (hex.length === 3) {
      // Short notation #RGB
      r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
    } else {
      // Standard notation #RRGGBB
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }

    return [r, g, b];
  }

  /**
   * Convert RGB values to hex colour
   * @param {number} r - Red value (0-255)
   * @param {number} g - Green value (0-255)
   * @param {number} b - Blue value (0-255)
   * @returns {string} Hex colour code
   */
  function rgbToHex(r, g, b) {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = Math.min(255, Math.max(0, Math.round(x))).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  /**
   * Calculate relative luminance of a colour (for WCAG contrast calculations)
   * @param {Array} rgb - RGB values array [r, g, b]
   * @returns {number} Relative luminance value
   */
  function calculateLuminance(rgb) {
    // Convert RGB values to sRGB
    const sRGB = rgb.map((val) => {
      val = val / 255;
      return val <= 0.03928
        ? val / 12.92
        : Math.pow((val + 0.055) / 1.055, 2.4);
    });

    // Calculate luminance using WCAG formula
    return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
  }

  /**
   * Calculate contrast ratio between two colours
   * @param {string} color1 - First colour in hex
   * @param {string} color2 - Second colour in hex
   * @returns {number} Contrast ratio (1-21)
   */
  function calculateContrastRatio(color1, color2) {
    const lum1 = calculateLuminance(hexToRgb(color1));
    const lum2 = calculateLuminance(hexToRgb(color2));

    // Calculate contrast ratio using WCAG formula
    const lighter = Math.max(lum1, lum2);
    const darker = Math.min(lum1, lum2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Adjust colour lightness until it meets the required contrast ratio
   * @param {string} baseColor - Base colour in hex
   * @param {string} targetColor - Target colour to contrast with in hex
   * @param {number} targetRatio - Target contrast ratio (3 for stroke, 4.5 for text)
   * @param {boolean} lighter - Whether to make the colour lighter (true) or darker (false)
   * @returns {string} Adjusted colour in hex
   */
  function adjustColorForContrast(
    baseColor,
    targetColor,
    targetRatio,
    lighter = true
  ) {
    const rgb = hexToRgb(baseColor);
    let currentRatio = calculateContrastRatio(baseColor, targetColor);
    let steps = 0;

    // Maximum number of iterations to prevent infinite loop
    const maxSteps = 100;

    // Adjust until we meet or exceed the target ratio
    while (currentRatio < targetRatio && steps < maxSteps) {
      // Adjust RGB values by different amounts for better colour preservation
      if (lighter) {
        rgb[0] = Math.min(255, rgb[0] + 5);
        rgb[1] = Math.min(255, rgb[1] + 5);
        rgb[2] = Math.min(255, rgb[2] + 5);
      } else {
        rgb[0] = Math.max(0, rgb[0] - 5);
        rgb[1] = Math.max(0, rgb[1] - 5);
        rgb[2] = Math.max(0, rgb[2] - 5);
      }

      const adjustedColor = rgbToHex(rgb[0], rgb[1], rgb[2]);
      currentRatio = calculateContrastRatio(adjustedColor, targetColor);
      steps++;
    }

    return rgbToHex(rgb[0], rgb[1], rgb[2]);
  }
  /**
   * Detect if the site is currently using dark theme
   * @returns {boolean} True if dark theme is active
   */
  function isDarkThemeActive() {
    // First check localStorage for explicit theme preference
    try {
      const storedTheme = localStorage.getItem("theme");
      if (storedTheme) {
        const isDark = storedTheme === "Dark";
        logDebug("Theme detected from localStorage:", storedTheme);
        return isDark;
      }
    } catch (e) {
      logWarn("Error accessing localStorage:", e);
    }

    // Check for theme attribute on modeToggle button (if site uses that pattern)
    const modeToggle = document.getElementById("modeToggle");
    if (modeToggle && modeToggle.getAttribute("aria-pressed") === "true") {
      logDebug("Dark theme active based on modeToggle button");
      return true;
    }

    // Fall back to system preference
    const systemPrefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    logDebug("Using system preference:", systemPrefersDark ? "dark" : "light");
    return systemPrefersDark;
  }

  /**
   * Get the appropriate default theme based on current site theme
   * @returns {string} Theme ID
   */
  function getDefaultThemeForCurrentMode() {
    const isDark = isDarkThemeActive();
    const themeToUse = isDark
      ? themeConfig.defaultThemes.dark
      : themeConfig.defaultThemes.light;

    logDebug("Current mode is:", isDark ? "dark" : "light");
    logDebug("Default theme for this mode:", themeToUse);

    return themeToUse;
  }
  /**
   * Generate an accessible theme based on mode and base colours
   * @param {boolean} isDarkMode - Whether to use dark mode colours
   * @returns {Object} Theme variables object
   */
  function generateAccessibleTheme(isDarkMode) {
    const baseColors = isDarkMode
      ? accessibleBaseColors.darkMode
      : accessibleBaseColors.lightMode;
    const { canvasColor, textColor, accentColor } = baseColors;

    // For light theme, ensure we have a proper light background and dark text
    const actualTextColor = isDarkMode ? textColor : "#000000"; // Force black text for light theme
    const actualCanvasColor = isDarkMode ? canvasColor : "#FFFFFF"; // Force white background for light theme

    // Calculate accessible colours
    const theme = {
      // Base colours
      darkMode: isDarkMode,
      background: actualCanvasColor,
      fontFamily: "trebuchet ms, verdana, arial, sans-serif",
      fontSize: "16px",
      textColor: actualTextColor,
    };

    // Light theme-specific adjustments
    if (!isDarkMode) {
      // For light theme, use specific colours that we know work well
      theme.primaryColor = "#FFFFFF"; // White node backgrounds
      theme.secondaryColor = "#E8F4F8"; // Light blue secondary nodes
      theme.tertiaryColor = "#F8F8F8"; // Very light gray tertiary
      theme.lineColor = "#333333"; // Dark gray lines
      theme.primaryTextColor = "#000000"; // Black text
      theme.secondaryTextColor = "#000000"; // Black text
      theme.tertiaryTextColor = "#000000"; // Black text
      theme.primaryBorderColor = "#333333"; // Dark borders
      theme.secondaryBorderColor = "#333333"; // Dark borders
      theme.tertiaryBorderColor = "#666666"; // Medium gray borders
      theme.noteBkgColor = "#FFF8DC"; // Light cream note background
      theme.noteTextColor = "#000000"; // Black note text
      theme.noteBorderColor = "#333333"; // Dark note borders
      theme.errorBkgColor = "#FFD2D2"; // Light red error background
      theme.errorTextColor = "#D8000C"; // Dark red error text
    } else {
      // For dark theme, keep the original calculation approach
      theme.primaryColor = isDarkMode ? "#2C3E50" : "#E8F4F8"; // Container fill colour
      theme.secondaryColor = accentColor; // Secondary container fill
      theme.tertiaryColor = isDarkMode ? "#34495E" : "#EAEAEA"; // Tertiary container fill

      // Line colours
      theme.lineColor = adjustColorForContrast(
        accentColor,
        canvasColor,
        3,
        !isDarkMode
      );

      // Notes
      theme.noteBkgColor = isDarkMode ? "#3A3A3A" : "#FFF8DC";
      theme.noteTextColor = isDarkMode ? "#FFFFFF" : "#333333";

      // Error colours
      theme.errorBkgColor = isDarkMode ? "#8B0000" : "#FFD2D2";
      theme.errorTextColor = isDarkMode ? "#FFFFFF" : "#D8000C";

      // Calculate derived colours with proper contrast
      theme.primaryTextColor = adjustColorForContrast(
        textColor,
        theme.primaryColor,
        4.5,
        isDarkMode
      );

      theme.primaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.primaryColor,
        3,
        !isDarkMode
      );

      theme.secondaryTextColor = adjustColorForContrast(
        textColor,
        theme.secondaryColor,
        4.5,
        isDarkMode
      );

      theme.secondaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.secondaryColor,
        3,
        !isDarkMode
      );

      theme.tertiaryTextColor = adjustColorForContrast(
        textColor,
        theme.tertiaryColor,
        4.5,
        isDarkMode
      );

      theme.tertiaryBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.tertiaryColor,
        3,
        !isDarkMode
      );

      theme.noteBorderColor = adjustColorForContrast(
        theme.lineColor,
        theme.noteBkgColor,
        3,
        !isDarkMode
      );
    }

    return theme;
  }
  // Create custom accessible themes
  const customThemes = [
    // Add this to your customThemes array in the MermaidThemes module
    {
      id: "wcagLight",
      name: "Varied Light",
      variables: {
        // Base settings
        darkMode: false,
        background: "#FFFFFF",
        fontFamily: "trebuchet ms, verdana, arial, sans-serif",
        fontSize: "16px",
        textColor: "#000000",

        // Basic colours with more blue accent
        primaryColor: "#E8F5FF", // Light blue background (was #FFFFFF)
        primaryTextColor: "#000000",
        primaryBorderColor: "#104E8B", // Medium blue border (was #000000)
        secondaryColor: "#F0F7FB", // Slightly darker blue (was #E8F4F8)
        secondaryTextColor: "#000000",
        secondaryBorderColor: "#104E8B", // Medium blue (was #000000)
        tertiaryColor: "#F4FAFF", // Very light blue (was #F8F8F8)
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#104E8B", // Medium blue (was #000000)

        // Lines and connectors
        lineColor: "#104E8B", // Medium blue line color (was #000000)
        defaultLinkColor: "#104E8B", // Medium blue link color (was #000000)

        // Notes, warnings, errors
        noteBkgColor: "#FFF8DC", // Keep this
        noteTextColor: "#000000",
        noteBorderColor: "#104E8B", // Medium blue (was #000000)

        // Entity colors - these are more likely to be applied in the diagram
        mainBkg: "#E8F5FF", // Light blue background
        nodeBorder: "#104E8B", // Medium blue
        nodeTextColor: "#000000",
        clusterBkg: "#F0F7FB",
        clusterBorder: "#104E8B",

        // Section colors - more likely to be used in mindmaps
        sectionBkgColor: "#E8F5FF",
        sectionBkgColor2: "#BBDEFB",
        sectionBkgColor3: "#90CAF9",
        sectionBkgColor4: "#64B5F6",
        sectionBkgColor5: "#42A5F5",
        sectionBkgColor6: "#2196F3",
        sectionBkgColor7: "#1E88E5",

        // Nodes and clusters
        nodeBorder: "#104E8B", // Change to blue instead of black
        nodeTextColor: "#000000",
        clusterBkg: "#F8F8F8",
        clusterBorder: "#104E8B", // Change to blue instead of black

        // Diagram element colours (WCAG AA compliant)
        // These are specifically designed for different diagram elements

        // Mindmap (high contrast colours)
        mindmapColor1: "#C8E6C9", // Light green
        mindmapColor2: "#BBDEFB", // Light blue
        mindmapColor3: "#E1BEE7", // Light purple
        mindmapColor4: "#FFE0B2", // Light orange
        mindmapColor5: "#F8BBD0", // Light pink
        mindmapColor6: "#B3E5FC", // Different light blue
        mindmapColor7: "#DCEDC8", // Different light green
        mindmapColor8: "#D7CCC8", // Light brown

        // Timeline colours
        timelineColor1: "#004D40", // Dark teal with white text
        timelineColor2: "#0D47A1", // Dark blue with white text
        timelineColor3: "#311B92", // Dark purple with white text
        timelineColor4: "#880E4F", // Dark pink with white text
        timelineColor5: "#3E2723", // Dark brown with white text
        timelineTextColor: "#FFFFFF", // White text for timeline items

        // Gantt chart (distinguishable but muted colours)
        taskBkgColor: "#BBDEFB", // Light blue
        taskBorderColor: "#1565C0", // Darker blue
        activeTaskBkgColor: "#C8E6C9", // Light green
        activeTaskBorderColor: "#2E7D32", // Darker green
        doneTaskBkgColor: "#E0E0E0", // Light grey
        doneTaskBorderColor: "#616161", // Darker grey
        critTaskBkgColor: "#FFCDD2", // Light red
        critTaskBorderColor: "#C62828", // Darker red

        // Git graph colours (8 distinct branch colours)
        gitBranchColor0: "#3E2723", // Dark brown
        gitBranchColor1: "#1565C0", // Dark blue
        gitBranchColor2: "#2E7D32", // Dark green
        gitBranchColor3: "#C62828", // Dark red
        gitBranchColor4: "#6A1B9A", // Dark purple
        gitBranchColor5: "#00695C", // Dark teal
        gitBranchColor6: "#FF6F00", // Dark orange
        gitBranchColor7: "#5D4037", // Different dark brown

        // Pie chart colours (all with sufficient contrast against white text)
        pie1: "#1565C0", // Dark blue
        pie2: "#2E7D32", // Dark green
        pie3: "#C62828", // Dark red
        pie4: "#6A1B9A", // Dark purple
        pie5: "#00695C", // Dark teal
        pie6: "#FF6F00", // Dark orange
        pie7: "#5D4037", // Dark brown
        pie8: "#0D47A1", // Different dark blue
        pie9: "#1B5E20", // Different dark green
        pie10: "#B71C1C", // Different dark red
        pie11: "#4A148C", // Different dark purple
        pie12: "#004D40", // Different dark teal
        pieTitleTextSize: "25px",
        pieTitleTextColor: "#000000",
        pieSectionTextSize: "17px",
        pieSectionTextColor: "#FFFFFF", // White text on dark backgrounds

        // Entity Relationship diagram colours
        classText: "#000000",
        classBorder: "#000000",
        labelBoxBkgColor: "#E8F4F8", // Light blue
        labelBoxBorderColor: "#000000",
        labelTextColor: "#000000",

        // Sequence diagram actors
        actorBkg: "#E8F4F8", // Light blue
        actorBorder: "#000000",
        actorTextColor: "#000000",
        actorLineColor: "#000000",

        // Other common elements
        loopTextColor: "#000000",
        activationBorderColor: "#000000",
        activationBkgColor: "#F8F8F8",
        sequenceNumberColor: "#000000",

        // User journey diagram
        fillType0: "#C8E6C9", // Light green
        fillType1: "#BBDEFB", // Light blue
        fillType2: "#E1BEE7", // Light purple
        fillType3: "#FFE0B2", // Light orange
        fillType4: "#F8BBD0", // Light pink
        fillType5: "#B3E5FC", // Different light blue
        fillType6: "#DCEDC8", // Different light green
        fillType7: "#D7CCC8", // Light brown

        // State diagram
        labelColor: "#000000",
        altBackground: "#F5F5F5", // Very light grey

        // Other elements
        edgeLabelBackground: "#FFFFFF",
        titleColor: "#000000",
      },
    },
    {
      id: "accessibleLight",
      name: "Plain Light",
      variables: generateAccessibleTheme(false), // Light mode
    },
    {
      id: "accessibleDark",
      name: "Dark V2",
      variables: generateAccessibleTheme(true), // Dark mode
    },
    {
      id: "highContrastLight",
      name: "High Contrast Light",
      variables: {
        darkMode: false,
        background: "#FFFFFF",
        primaryColor: "#FFFFFF",
        primaryTextColor: "#000000",
        primaryBorderColor: "#000000",
        lineColor: "#000000",
        textColor: "#000000",
        secondaryColor: "#EEEEEE",
        secondaryTextColor: "#000000",
        secondaryBorderColor: "#000000",
        tertiaryColor: "#DDDDDD",
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#000000",
        noteBkgColor: "#FFFFFF",
        noteTextColor: "#000000",
        noteBorderColor: "#000000",
      },
    },
    {
      id: "highContrastDark",
      name: "High Contrast Dark",
      variables: {
        darkMode: true,
        background: "#000000",
        primaryColor: "#000000",
        primaryTextColor: "#FFFFFF",
        primaryBorderColor: "#FFFFFF",
        lineColor: "#FFFFFF",
        textColor: "#FFFFFF",
        secondaryColor: "#222222",
        secondaryTextColor: "#FFFFFF",
        secondaryBorderColor: "#FFFFFF",
        tertiaryColor: "#333333",
        tertiaryTextColor: "#FFFFFF",
        tertiaryBorderColor: "#FFFFFF",
        noteBkgColor: "#000000",
        noteTextColor: "#FFFFFF",
        noteBorderColor: "#FFFFFF",
      },
    },
    {
      id: "blueAccent",
      name: "Blue Accent",
      variables: {
        nodeBorder: "#004990",
        mainBkg: "#c9d7e4",
        background: "#FFFFFF",
        primaryColor: "#c9d7e4",
        primaryTextColor: "#000000", // Changed for better contrast
        primaryBorderColor: "#004990",
        secondaryColor: "#01A6F0",
        secondaryTextColor: "#FFFFFF", // Changed for better contrast
        secondaryBorderColor: "#004990",
        tertiaryColor: "#F8F8F8",
        tertiaryTextColor: "#000000",
        tertiaryBorderColor: "#004990",
        noteBkgColor: "#FFBA01",
        noteTextColor: "#000000", // Changed for better contrast
        noteBorderColor: "#FFBA01",
        lineColor: "#004990",
        textColor: "#000000", // Changed from #747474 for better contrast
        actorBkg: "#01A6F0",
        signalColor: "#F34F1C",
        loopTextColor: "#4A4A4A", // Changed from #C7C7C7 for better contrast
        labelTextColor: "#000000", // Changed from #C7C7C7 for better contrast
        labelBoxBorderColor: "#7FBC00",
        labelBoxBkgColor: "#7FBC00",
        fontFamily: "Inter, sans-serif",
        fontSize: "13px",
      },
    },
  ];
  /**
   * Apply a theme to a Mermaid diagram
   * @param {HTMLElement} container - The container with the Mermaid diagram
   * @param {string} themeId - The ID of the theme to apply
   */
  function applyTheme(container, themeId) {
    if (!container) return;

    logDebug(`Applying theme "${themeId}" to container`);

    // Find the Mermaid diagram inside the container
    const mermaidDiv = container.querySelector(".mermaid");
    if (!mermaidDiv) {
      logWarn("No mermaid diagram found in container");
      return;
    }

    // Get the original Mermaid code
    const originalCode =
      decodeURIComponent(container.getAttribute("data-diagram-code")) ||
      mermaidDiv.textContent;

    // Create new code with the theme directive
    let newCode = originalCode;

    // Check if it's a built-in theme or custom theme
    const customTheme = customThemes.find((theme) => theme.id === themeId);

    if (customTheme) {
      // For custom themes, we need to use the 'base' theme and apply theme variables
      const initDirective = `%%{init: {'theme': 'base', 'themeVariables': ${JSON.stringify(
        customTheme.variables
      )}}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive
      newCode = initDirective + newCode;
      logDebug(`Applied custom theme variables for "${themeId}"`);
    } else if (builtInThemes.find((theme) => theme.id === themeId)) {
      // For built-in themes, we just need to specify the theme name
      const initDirective = `%%{init: {'theme': '${themeId}'}}%%\n`;

      // Remove any existing init directive
      newCode = newCode.replace(/^%%{init:.*?}%%\n/m, "");

      // Add new init directive
      newCode = initDirective + newCode;
      logDebug(`Applied built-in theme "${themeId}"`);
    }

    // Update the container with the new code
    container.setAttribute("data-diagram-code", encodeURIComponent(newCode));

    // Re-render the diagram
    const mermaidId = mermaidDiv.id;
    mermaidDiv.textContent = newCode;

    window.mermaid
      .render(mermaidId + "-svg", newCode)
      .then((result) => {
        mermaidDiv.innerHTML = result.svg;
        logInfo(`Successfully re-rendered diagram with theme "${themeId}"`);

        // Re-apply size settings if MermaidControls is available
        const svg = mermaidDiv.querySelector("svg");
        if (
          svg &&
          window.MermaidControls &&
          typeof window.MermaidControls.applyDiagramSize === "function"
        ) {
          const widthSlider = container.querySelector(
            'input[id^="mermaid-width-slider"]'
          );
          const heightSlider = container.querySelector(
            'input[id^="mermaid-height-slider"]'
          );
          const aspectRatioCheckbox = container.querySelector(
            ".aspect-ratio-checkbox"
          );

          if (widthSlider && heightSlider) {
            window.MermaidControls.applyDiagramSize(
              svg,
              widthSlider.value,
              heightSlider.value,
              aspectRatioCheckbox ? aspectRatioCheckbox.checked : false
            );
            logDebug("Re-applied diagram size settings");
          }
        }

        // Re-initialize controls if needed
        if (
          window.MermaidControls &&
          typeof window.MermaidControls.addControlsToContainer === "function"
        ) {
          const index = mermaidId.split("-").pop();
          window.MermaidControls.addControlsToContainer(container, index);
          logDebug("Re-initialised diagram controls");
        }
      })
      .catch((error) => {
        logError("Error re-rendering Mermaid diagram:", error);
        mermaidDiv.textContent = `Error rendering diagram with theme: ${error.message}`;
      });
  }
  /**
   * Get all available themes (built-in and custom) filtered by visibility settings
   * @returns {Array} Array of theme objects with id and name properties
   */
  /**
   * Get all available themes (built-in and custom) filtered by visibility settings
   * @returns {Array} Array of theme objects with id and name properties
   */
  function getAllThemes() {
    const allThemes = [...builtInThemes, ...customThemes];
    const isDark = isDarkThemeActive();

    // Get themes visible in current mode
    const modeVisibleIds = themeConfig.modeVisibleThemes
      ? isDark
        ? themeConfig.modeVisibleThemes.dark
        : themeConfig.modeVisibleThemes.light
      : null;

    // Filter themes based on visibility configuration
    const filteredThemes = allThemes.filter((theme) => {
      // First check if theme is visible at all
      const isVisible = themeConfig.visibleThemes[theme.id] !== false;

      // Then check if it's visible in current mode (if mode filtering is enabled)
      const isVisibleInMode = modeVisibleIds
        ? modeVisibleIds.includes(theme.id)
        : true;

      return isVisible && isVisibleInMode;
    });

    logDebug(
      `Retrieved ${filteredThemes.length} available themes for ${
        isDark ? "dark" : "light"
      } mode`
    );
    return filteredThemes;
  }

  /**
   * Validate a theme's contrast ratios
   * @param {Object} themeVars - Theme variables object
   * @returns {Object} Validation results with any issues found
   */
  function validateThemeContrast(themeVars) {
    const issues = [];
    const background = themeVars.background || "#f4f4f4";

    // Check text contrast (4.5:1 minimum)
    const textRatio = calculateContrastRatio(
      themeVars.textColor || "#333333",
      background
    );
    if (textRatio < 4.5) {
      issues.push(
        `Text to background contrast ratio is ${textRatio.toFixed(
          2
        )}:1, should be at least 4.5:1`
      );
    }

    // Check primary text contrast (4.5:1 minimum)
    const primaryTextRatio = calculateContrastRatio(
      themeVars.primaryTextColor || "#333333",
      themeVars.primaryColor || "#fff4dd"
    );
    if (primaryTextRatio < 4.5) {
      issues.push(
        `Primary text to primary background contrast ratio is ${primaryTextRatio.toFixed(
          2
        )}:1, should be at least 4.5:1`
      );
    }

    // Check line to background contrast (3:1 minimum)
    const lineRatio = calculateContrastRatio(
      themeVars.lineColor || "#333333",
      background
    );
    if (lineRatio < 3) {
      issues.push(
        `Line to background contrast ratio is ${lineRatio.toFixed(
          2
        )}:1, should be at least 3:1`
      );
    }

    // Check primary border to primary background contrast (3:1 minimum)
    const primaryBorderRatio = calculateContrastRatio(
      themeVars.primaryBorderColor || "#7C0000",
      themeVars.primaryColor || "#fff4dd"
    );
    if (primaryBorderRatio < 3) {
      issues.push(
        `Primary border to primary background contrast ratio is ${primaryBorderRatio.toFixed(
          2
        )}:1, should be at least 3:1`
      );
    }

    const result = {
      valid: issues.length === 0,
      issues: issues,
    };

    if (result.valid) {
      logDebug("Theme contrast validation passed");
    } else {
      logWarn("Theme contrast validation failed:", result.issues);
    }

    return result;
  }
  /**
   * Add a theme selector to a Mermaid container
   * @param {HTMLElement} container - The Mermaid container
   * @param {number} index - Index for unique IDs
   */
  function addThemeSelector(container, index) {
    logDebug("Adding theme selector to container", index);

    // Check if controls container exists
    const controlsContainer = container.querySelector(".mermaid-controls");
    if (!controlsContainer) {
      logDebug("No controls container found, aborting");
      return;
    }

    // Check if theme selector already exists
    if (container.querySelector(".mermaid-theme-select")) {
      logDebug("Theme selector already exists, aborting");
      return;
    }

    // Find the sliders container
    const slidersContainer =
      controlsContainer.querySelector(".sliders-container");
    if (!slidersContainer) {
      logDebug("No sliders container found, aborting");
      return;
    }

    // Create theme selector container
    const themeContainer = document.createElement("div");
    themeContainer.className = "mermaid-theme-container";

    // Create label
    const themeLabel = document.createElement("label");
    themeLabel.textContent = "Theme:";
    themeLabel.className = "mermaid-theme-label";
    themeLabel.setAttribute("for", `mermaid-theme-${index}`);

    // Create select element
    const themeSelect = document.createElement("select");
    themeSelect.id = `mermaid-theme-${index}`;
    themeSelect.className = "mermaid-theme-select";
    themeSelect.setAttribute("aria-label", "Change diagram theme");

    // Get all available themes
    const availableThemes = getAllThemes();
    logDebug(
      "Available themes:",
      availableThemes.map((t) => t.id)
    );

    // Add theme options (filtered by visibility config)
    availableThemes.forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme.id;
      option.textContent = theme.name;
      themeSelect.appendChild(option);
    });

    // Get default theme for current mode
    const defaultTheme = getDefaultThemeForCurrentMode();
    logDebug("Default theme to use:", defaultTheme);

    // Set the default theme as the selected option
    themeSelect.value = defaultTheme;

    // Add event listener for theme changes
    themeSelect.addEventListener("change", function () {
      const newTheme = this.value;
      logInfo("User changed theme to:", newTheme);

      // Apply the theme to the diagram (but don't save preference)
      applyTheme(container, newTheme);

      // Announce to screen readers if MermaidControls is available
      if (
        window.MermaidControls &&
        typeof window.MermaidControls.announceToScreenReader === "function"
      ) {
        window.MermaidControls.announceToScreenReader(
          `Theme changed to ${this.options[this.selectedIndex].text}`
        );
      }
    });

    // Add theme selector to container
    themeContainer.appendChild(themeLabel);
    themeContainer.appendChild(themeSelect);

    // Create a new row container for the theme selector
    const themeRow = document.createElement("div");
    themeRow.className = "mermaid-controls-row";
    themeRow.appendChild(themeContainer);

    // Append as the last row in the sliders container
    slidersContainer.appendChild(themeRow);

    // Apply the default theme
    logDebug("Applying theme:", defaultTheme);
    applyTheme(container, defaultTheme);

    logInfo("Theme selector added and theme applied");
  }
  // Find the updateDiagramsForThemeChange function and replace it with this updated version:

  /**
   * Update mermaid diagrams when site theme changes
   * This function should be called when the site theme is toggled
   */
  function updateDiagramsForThemeChange() {
    logInfo("Theme change detected, updating diagrams");

    // Get all mermaid containers
    const mermaidContainers = document.querySelectorAll(".mermaid-container");
    logDebug("Found", mermaidContainers.length, "mermaid containers");

    // Get the current appropriate default theme
    const newDefaultTheme = getDefaultThemeForCurrentMode();
    logDebug("Current default theme for mode:", newDefaultTheme);

    // Get visible themes for current mode
    const visibleThemes = getAllThemes();

    mermaidContainers.forEach((container, idx) => {
      const themeSelect = container.querySelector(".mermaid-theme-select");
      if (!themeSelect) {
        logDebug("No theme select found for container", idx);
        return;
      }

      // Update available options
      while (themeSelect.firstChild) {
        themeSelect.removeChild(themeSelect.firstChild);
      }

      // Add new options
      visibleThemes.forEach((theme) => {
        const option = document.createElement("option");
        option.value = theme.id;
        option.textContent = theme.name;
        themeSelect.appendChild(option);
      });

      // Set selected theme to default for current mode
      themeSelect.value = newDefaultTheme;
      applyTheme(container, newDefaultTheme);
    });

    logInfo(`Updated ${mermaidContainers.length} diagrams for theme change`);
  }
  /**
   * Create a custom theme based on user preferences
   * @param {Object} options - Theme options
   * @returns {Object} Custom theme variables
   */
  function createCustomTheme(options = {}) {
    const isDarkMode = options.darkMode || false;
    const baseTextColor =
      options.textColor || (isDarkMode ? "#FFFFFF" : "#333333");
    const baseCanvasColor =
      options.backgroundColor || (isDarkMode ? "#1E1E1E" : "#FFFFFF");
    const baseAccentColor =
      options.accentColor || (isDarkMode ? "#6082B6" : "#1E56A0");

    logDebug("Creating custom theme:", {
      isDarkMode,
      baseTextColor,
      baseCanvasColor,
      baseAccentColor,
    });

    // Override base colours
    accessibleBaseColors.darkMode.textColor = isDarkMode
      ? baseTextColor
      : accessibleBaseColors.darkMode.textColor;
    accessibleBaseColors.darkMode.canvasColor = isDarkMode
      ? baseCanvasColor
      : accessibleBaseColors.darkMode.canvasColor;
    accessibleBaseColors.darkMode.accentColor = isDarkMode
      ? baseAccentColor
      : accessibleBaseColors.darkMode.accentColor;

    accessibleBaseColors.lightMode.textColor = !isDarkMode
      ? baseTextColor
      : accessibleBaseColors.lightMode.textColor;
    accessibleBaseColors.lightMode.canvasColor = !isDarkMode
      ? baseCanvasColor
      : accessibleBaseColors.lightMode.canvasColor;
    accessibleBaseColors.lightMode.accentColor = !isDarkMode
      ? baseAccentColor
      : accessibleBaseColors.lightMode.accentColor;

    // Generate theme
    const customTheme = generateAccessibleTheme(isDarkMode);
    logInfo("Custom theme created successfully");
    return customTheme;
  }

  /**
   * Initialize theme selection for all Mermaid diagrams
   * @param {HTMLElement} container - Container element (defaults to document)
   */
  function init(container = document) {
    // Find all Mermaid containers
    const mermaidContainers = container.querySelectorAll(".mermaid-container");
    if (mermaidContainers.length === 0) {
      logDebug("No mermaid containers found for initialisation");
      return;
    }

    logInfo(
      `Initialising theme selectors for ${mermaidContainers.length} diagrams`
    );

    // Add theme selector to each diagram
    mermaidContainers.forEach((container, index) => {
      addThemeSelector(container, index);
    });

    logInfo("Theme system initialisation complete");
  }

  /**
   * Validates WCAG AA compliance for all theme colours
   * @param {Object} themeVars - Theme variables object
   * @returns {Object} Object with validation results
   */
  function validateWCAGCompliance(themeVars) {
    const results = {
      pass: true,
      failures: [],
    };

    // For text on coloured backgrounds (4.5:1 minimum)
    const textElements = [
      {
        background: themeVars.mindmapColor1,
        text: themeVars.textColor,
        name: "Mindmap Colour 1",
      },
      {
        background: themeVars.mindmapColor2,
        text: themeVars.textColor,
        name: "Mindmap Colour 2",
      },
      {
        background: themeVars.mindmapColor3,
        text: themeVars.textColor,
        name: "Mindmap Colour 3",
      },
      {
        background: themeVars.mindmapColor4,
        text: themeVars.textColor,
        name: "Mindmap Colour 4",
      },
      {
        background: themeVars.mindmapColor5,
        text: themeVars.textColor,
        name: "Mindmap Colour 5",
      },
      {
        background: themeVars.mindmapColor6,
        text: themeVars.textColor,
        name: "Mindmap Colour 6",
      },
      {
        background: themeVars.mindmapColor7,
        text: themeVars.textColor,
        name: "Mindmap Colour 7",
      },
      {
        background: themeVars.mindmapColor8,
        text: themeVars.textColor,
        name: "Mindmap Colour 8",
      },

      // Timeline and pie charts use white text on dark backgrounds
      {
        background: themeVars.timelineColor1,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 1",
      },
      {
        background: themeVars.timelineColor2,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 2",
      },
      {
        background: themeVars.timelineColor3,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 3",
      },
      {
        background: themeVars.timelineColor4,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 4",
      },
      {
        background: themeVars.timelineColor5,
        text: themeVars.timelineTextColor,
        name: "Timeline Colour 5",
      },

      {
        background: themeVars.pie1,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 1",
      },
      {
        background: themeVars.pie2,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 2",
      },
      {
        background: themeVars.pie3,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 3",
      },
      {
        background: themeVars.pie4,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 4",
      },
      {
        background: themeVars.pie5,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 5",
      },
      {
        background: themeVars.pie6,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 6",
      },
      {
        background: themeVars.pie7,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 7",
      },
      {
        background: themeVars.pie8,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 8",
      },
      {
        background: themeVars.pie9,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 9",
      },
      {
        background: themeVars.pie10,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 10",
      },
      {
        background: themeVars.pie11,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 11",
      },
      {
        background: themeVars.pie12,
        text: themeVars.pieSectionTextColor,
        name: "Pie Chart Colour 12",
      },

      // Gantt chart colours
      {
        background: themeVars.taskBkgColor,
        text: themeVars.textColor,
        name: "Task Background",
      },
      {
        background: themeVars.activeTaskBkgColor,
        text: themeVars.textColor,
        name: "Active Task Background",
      },
      {
        background: themeVars.doneTaskBkgColor,
        text: themeVars.textColor,
        name: "Done Task Background",
      },
      {
        background: themeVars.critTaskBkgColor,
        text: themeVars.textColor,
        name: "Critical Task Background",
      },
    ];

    // Check all text elements for 4.5:1 minimum contrast
    textElements.forEach((element) => {
      if (!element.background || !element.text) return;

      const ratio = calculateContrastRatio(element.background, element.text);

      if (ratio < 4.5) {
        results.pass = false;
        results.failures.push({
          element: element.name,
          background: element.background,
          text: element.text,
          ratio: ratio.toFixed(2),
          recommendation: "Needs at least 4.5:1 contrast ratio for text",
        });
      }
    });

    // For non-text elements (visual boundaries, etc.) - 3:1 minimum
    const graphicElements = [
      {
        foreground: themeVars.primaryBorderColor,
        background: themeVars.primaryColor,
        name: "Primary Border vs Background",
      },
      {
        foreground: themeVars.secondaryBorderColor,
        background: themeVars.secondaryColor,
        name: "Secondary Border vs Background",
      },
      {
        foreground: themeVars.lineColor,
        background: themeVars.background,
        name: "Line vs Background",
      },
      {
        foreground: themeVars.defaultLinkColor,
        background: themeVars.background,
        name: "Link vs Background",
      },
    ];

    // Check all graphic elements for 3:1 minimum contrast
    graphicElements.forEach((element) => {
      if (!element.foreground || !element.background) return;

      const ratio = calculateContrastRatio(
        element.foreground,
        element.background
      );

      if (ratio < 3) {
        results.pass = false;
        results.failures.push({
          element: element.name,
          foreground: element.foreground,
          background: element.background,
          ratio: ratio.toFixed(2),
          recommendation:
            "Needs at least 3:1 contrast ratio for graphical elements",
        });
      }
    });

    if (results.pass) {
      logDebug("WCAG compliance validation passed");
    } else {
      logWarn(
        "WCAG compliance validation failed:",
        results.failures.length,
        "issues found"
      );
    }

    return results;
  }

  // Initialize when DOM is fully loaded
  document.addEventListener("DOMContentLoaded", function () {
    logDebug("DOM content loaded");

    // Initialize for existing diagrams after a short delay
    // to ensure MermaidControls has been initialised
    setTimeout(function () {
      logDebug("Running delayed initialisation");

      if (typeof window.MermaidThemes !== "undefined") {
        logInfo("MermaidThemes module found, beginning initialisation");
        window.MermaidThemes.init();
      } else {
        logError("MermaidThemes module is undefined!");
      }
    }, 300);
  });

  // Public API
  return {
    init: init,
    addThemeSelector: addThemeSelector,
    applyTheme: applyTheme,
    getAllThemes: getAllThemes,
    createCustomTheme: createCustomTheme,
    validateThemeContrast: validateThemeContrast,
    validateWCAGCompliance: validateWCAGCompliance, // Add this new function
    calculateContrastRatio: calculateContrastRatio,
    updateDiagramsForThemeChange: updateDiagramsForThemeChange,
    themeConfig: themeConfig, // Expose configuration for external modification
    // Expose logging controls
    setLogLevel: setLogLevel,
    LOG_LEVELS: LOG_LEVELS,
    utils: {
      hexToRgb: hexToRgb,
      rgbToHex: rgbToHex,
      calculateLuminance: calculateLuminance,
      adjustColorForContrast: adjustColorForContrast,
      isDarkThemeActive: isDarkThemeActive,
      getDefaultThemeForCurrentMode: getDefaultThemeForCurrentMode,
    },
  };
})();
