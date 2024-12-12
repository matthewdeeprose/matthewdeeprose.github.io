/**
 * @fileoverview Template Builder for UI Components
 *
 * This class provides static methods that generate HTML strings for various UI components.
 * Each method is pure and returns a string of HTML with appropriate ARIA attributes
 * and accessibility features maintained.
 *
 * Accessibility features:
 * - Semantic HTML structure
 * - ARIA labels and roles
 * - Screen reader friendly content
 * - Clear hierarchical structure
 */

export class TemplateBuilder {
  /**
   * Generates HTML for upload statistics display
   * @param {Object} stats Statistics about color combinations
   * @param {Array} validBackgrounds Array of valid background colors with names
   * @param {Array} invalidBackgrounds Array of invalid background colors with reasons
   * @returns {string} HTML string
   */
  static buildUploadStats(stats, validBackgrounds, invalidBackgrounds) {
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

    const backgroundsSection =
      stats.totalColors > 0
        ? `
            <div class="backgrounds-section">
                ${this.buildValidBackgroundsSection(validBackgrounds)}
                ${this.buildInvalidBackgroundsSection(invalidBackgrounds)}
            </div>
        `
        : "";

    return statsHtml + backgroundsSection;
  }

  /**
   * Generates HTML for valid backgrounds section
   * @param {Array} validBackgrounds Array of valid background colors with names
   * @returns {string} HTML string
   */
  static buildValidBackgroundsSection(validBackgrounds) {
    return `
            <div class="valid-backgrounds-section">
                <button class="toggle-backgrounds" aria-expanded="false" 
                        aria-controls="validBackgroundsList">
                    Show valid background colours (${validBackgrounds.length})
                </button>
                <div id="validBackgroundsList" class="backgrounds-list" hidden>
                    <h4>Valid Background Colours</h4>
                    <ul class="color-swatches" role="list">
                        ${validBackgrounds
                          .map((data) => this.buildValidBackgroundItem(data))
                          .join("")}
                    </ul>
                </div>
            </div>
        `;
  }

  /**
   * Generates HTML for a single valid background color item
   * @param {Object} data Color data including hex, name, and versatility information
   * @returns {string} HTML string
   */
  static buildValidBackgroundItem(data) {
    return `
            <li class="color-swatch-item ${
              data.isHighlyVersatile ? "highly-versatile" : ""
            }">
                <span class="color-swatch Trichromacy" 
                      style="background-color: ${data.hex};"
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
                    ${this.buildColorCompatibilityInfo(data)}
                </span>
            </li>
        `;
  }

  /**
   * Generates HTML for invalid backgrounds section
   * @param {Array} invalidBackgrounds Array of invalid background colors with reasons
   * @returns {string} HTML string
   */
  static buildInvalidBackgroundsSection(invalidBackgrounds) {
    return `
            <div class="invalid-backgrounds-section">
                <button class="toggle-backgrounds" aria-expanded="false" 
                        aria-controls="invalidBackgroundsList">
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
        `;
  }

  /**
   * Generates HTML for color compatibility information
   * @param {Object} data Color data including colorSet information
   * @returns {string} HTML string
   */
  static buildColorCompatibilityInfo(data) {
    const aaaCount = data.colorSet.textColors.filter(
      (color) => chroma.contrast(data.hex, color.colourHex) >= 7
    ).length;

    const aaCount = data.colorSet.textColors.filter((color) => {
      const contrast = chroma.contrast(data.hex, color.colourHex);
      return contrast >= 4.5 && contrast < 7;
    }).length;

    return `
            <div class="color-versatility">
                <span class="text-options">
                    <span class="contrast-breakdown">
                        <ul class="color-compatibility-list" role="list">
                            <li class="main-compatibility">
                                Sufficient contrast with ${
                                  data.textOptions
                                } text colour${
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
                                Sufficient contrast with ${
                                  data.graphicOptions
                                } graphic colour${
      data.graphicOptions !== 1 ? "s" : ""
    }.
                            </li>
                        </ul>
                    </span>
                </span>
                <button class="show-combinations" aria-expanded="false" 
                        aria-controls="combinations-${data.hex.substring(1)}">
                    Show colours with sufficient contrast
                </button>
                <div id="combinations-${data.hex.substring(1)}" 
                     class="combinations-panel" hidden>
                    ${this.buildCompatibleColorsPanel(data)}
                </div>
            </div>
        `;
  }

  /**
   * Generates HTML for compatible colors panel
   * @param {Object} data Color data including colorSet information
   * @returns {string} HTML string
   */
  static buildCompatibleColorsPanel(data) {
    return `
            <h5>Colours with sufficient contrast</h5>
            <div class="compatible-colors">
                ${this.buildCompatibleTextColors(data)}
                ${this.buildCompatibleGraphicColors(data)}
            </div>
        `;
  }

  /**
   * Generates HTML for compatible text colors
   * @param {Object} data Color data including colorSet information
   * @returns {string} HTML string
   */
  static buildCompatibleTextColors(data) {
    const backgroundColor = data.hex;
    const textColors = data.colorSet.textColors;

    // Split colors into AAA and AA groups
    const aaaColors = textColors.filter(
      (color) => chroma.contrast(backgroundColor, color.colourHex) >= 7
    );
    const aaColors = textColors.filter((color) => {
      const contrast = chroma.contrast(backgroundColor, color.colourHex);
      return contrast >= 4.5 && contrast < 7;
    });

    return `
            <div class="text-colors">
                <h5>Text Colors</h5>
                ${this.buildContrastLevelList(
                  aaaColors,
                  backgroundColor,
                  "Enhanced Contrast (7:1+)"
                )}
                ${this.buildContrastLevelList(
                  aaColors,
                  backgroundColor,
                  "Standard Contrast (4.5:1 to 6.9:1)"
                )}
            </div>
        `;
  }

  /**
   * Generates HTML for compatible graphic colors
   * @param {Object} data Color data including colorSet information
   * @returns {string} HTML string
   */
  static buildCompatibleGraphicColors(data) {
    const backgroundColor = data.hex;
    const graphicColors = data.colorSet.graphicColors;

    return `
            <div class="graphic-colors">
                <h5>Graphic Colours</h5>
                <ul class="graphics-compatibility" role="list">
                    <li class="graphic-options">
                        Sufficient contrast with ${
                          graphicColors.length
                        } graphic colour${
      graphicColors.length !== 1 ? "s" : ""
    }.
                    </li>
                </ul>
                <ul class="compatible-color-list" role="list">
                    ${graphicColors
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
            </div>
        `;
  }

  /**
   * Generates HTML for a list of colors at a specific contrast level
   * @param {Array} colors Array of colors
   * @param {string} backgroundColor Background color to check contrast against
   * @param {string} title Title for the contrast level
   * @returns {string} HTML string
   */
  static buildContrastLevelList(colors, backgroundColor, title) {
    if (colors.length === 0) return "";

    return `
            <h6>${title}</h6>
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
  /**
   * Builds the complete color management UI HTML
   * @param {Array} colors Array of color objects
   * @param {Set} activeColors Set of currently active color hexes
   * @returns {string} Complete HTML for color management section
   */
  static buildColorManagementUI(colors, activeColors) {
    return `
        <h2 class="color-management-heading">Colour Selection</h2>
        <fieldset>
            <legend>Available Colours</legend>
            
            ${this.buildSelectAllSection()}
            
            ${this.buildColorList(colors, activeColors)}
        </fieldset>
        
        <div id="colorSelectionAnnouncement" class="sr-only" role="status" aria-live="polite"></div>
    `;
  }

  /**
   * Builds the select all section HTML
   * @param {Array} colors Array of all color objects
   * @param {Set} activeColors Set of currently active color hexes
   * @returns {string} HTML for select all controls
   */
  static buildSelectAllSection(colors, activeColors) {
    const allSelected =
      colors.length > 0 && colors.length === activeColors.size;

    return `
        <div class="select-all-container">
            <input type="checkbox" 
                   id="selectAllColors" 
                   aria-controls="colorList"
                   ${allSelected ? "checked" : ""}>
            <label for="selectAllColors">Select all colours</label>
        </div>
    `;
  }

  /**
   * Builds the complete color management UI HTML
   * @param {Array} colors Array of color objects
   * @param {Set} activeColors Set of currently active color hexes
   * @returns {string} Complete HTML for color management section
   */
  static buildColorManagementUI(colors, activeColors) {
    return `
        <h2 class="color-management-heading">Colour Selection</h2>
        <fieldset>
            <legend>Available Colours</legend>
            
            ${this.buildSelectAllSection(colors, activeColors)}
            
            ${this.buildColorList(colors, activeColors)}
        </fieldset>
        
        <div id="colorSelectionAnnouncement" class="sr-only" role="status" aria-live="polite"></div>
    `;
  }

  /**
   * Builds the color list HTML
   * @param {Array} colors Array of color objects
   * @param {Set} activeColors Set of currently active color hexes
   * @returns {string} HTML for color list
   */
  static buildColorList(colors, activeColors) {
    return `
        <ul id="colorList" class="color-list" role="list" aria-label="Colour options">
            ${colors
              .map((color) =>
                this.buildColorItem(color, activeColors.has(color.colourHex))
              )
              .join("")}
        </ul>
    `;
  }

  /**
   * Builds a single color item HTML
   * @param {Object} color Color object with colourHex and name
   * @param {boolean} isActive Whether the color is currently active
   * @returns {string} HTML for color item
   */
  static buildColorItem(color, isActive) {
    return `
        <li class="color-item">
            <input type="checkbox" 
                   id="color-${color.colourHex}"
                   ${isActive ? "checked" : ""}
                   aria-describedby="desc-${color.colourHex}">
            
            <span class="color-swatch Trichromacy" 
                  style="background-color: ${color.colourHex};"
                  role="presentation"></span>
            
            <label for="color-${color.colourHex}">${color.name}</label>
            
            <span id="desc-${color.colourHex}" class="sr-only">
                Color: ${color.name}, Hex value: ${color.colourHex}
            </span>
        </li>
    `;
  }
  /**
   * Generates HTML for displaying compatible colors with contrast information
   * Supports both text and graphic colors with appropriate ARIA attributes
   *
   * @param {Array} colors Array of compatible colors
   * @param {string} backgroundColor Background color to check contrast against
   * @param {string} type Type of colors ('text' or 'graphic')
   * @returns {string} HTML for color compatibility display
   */
  static buildCompatibleColorsDisplay(colors, backgroundColor, type) {
    if (type === "text") {
      // Split colors into AAA and AA groups for text colors
      const aaaColors = colors.filter(
        (color) => chroma.contrast(backgroundColor, color.colourHex) >= 7
      );
      const aaColors = colors.filter((color) => {
        const contrast = chroma.contrast(backgroundColor, color.colourHex);
        return contrast >= 4.5 && contrast < 7;
      });

      return `
          <div class="text-colors" role="region" aria-label="Text color compatibility">
              <h5>Text Colors</h5>
              <ul class="text-compatibility" role="list">
                  <li class="text-options">
                      <ul class="contrast-breakdown" role="list">
                          <li class="contrast-level">
                              <span class="aaa-count" title="Enhanced contrast (7:1+)">
                                  ${aaaColors.length} at AAA level
                              </span>
                          </li>
                          <li class="contrast-level">
                              <span class="aa-count" title="Standard contrast (4.5:1 to 6.9:1)">
                                  ${aaColors.length} at AA level
                              </span>
                          </li>
                      </ul>
                  </li>
              </ul>
              ${this.buildColorDetailsList(
                aaaColors,
                backgroundColor,
                "Enhanced Contrast (7:1+)"
              )}
              ${this.buildColorDetailsList(
                aaColors,
                backgroundColor,
                "Standard Contrast (4.5:1 to 6.9:1)"
              )}
          </div>
      `;
    } else {
      // For graphic colors
      return `
          <div class="graphic-colors" role="region" aria-label="Graphic color compatibility">
              <ul class="graphics-compatibility" role="list">
                  <li class="graphic-options">
                      Sufficient contrast with ${colors.length} graphic colour${
        colors.length !== 1 ? "s" : ""
      }.
                  </li>
              </ul>
              ${this.buildColorDetailsList(colors, backgroundColor)}
          </div>
      `;
    }
  }

  /**
   * Generates HTML for a list of color details with contrast ratios
   *
   * @param {Array} colors Array of colors to display
   * @param {string} backgroundColor Background color for contrast calculation
   * @param {string} title Optional section title
   * @returns {string} HTML for color details list
   */
  static buildColorDetailsList(colors, backgroundColor, title = "") {
    if (colors.length === 0) return "";

    return `
      ${title ? `<h6>${title}</h6>` : ""}
      <ul class="compatible-color-list" role="list">
          ${colors
            .map(
              (color) => `
              <li>
                  <div class="color-swatch-container">
                      <span class="color-swatch mini Trichromacy" 
                            style="background-color: ${color.colourHex};"
                            role="presentation"></span>
                      <span class="color-details">
                          <span class="color-name">${color.name}</span>
                          <span class="contrast-ratio" aria-label="Contrast ratio">
                              (${chroma
                                .contrast(backgroundColor, color.colourHex)
                                .toFixed(1)}:1)
                          </span>
                      </span>
                  </div>
              </li>
          `
            )
            .join("")}
      </ul>
  `;
  }
  /**
   * Generates HTML for a hold button's inner content
   * @param {Object} options Button configuration options
   * @param {string} options.colorType Type of color (background, text, graphic1, etc)
   * @param {boolean} options.isHeld Whether the color is currently held
   * @returns {string} Hold button inner HTML
   */
  static buildHoldButtonContent(options) {
    const { colorType, isHeld } = options;

    return `
      <svg width="20" 
           height="20" 
           aria-hidden="true" 
           focusable="false">
          <use href="#icon-${isHeld ? "lock" : "unlock"}"></use>
      </svg>
      <span class="visually-hidden">
          ${isHeld ? "Unlock" : "Lock"} ${colorType} colour
      </span>
  `;
  }

  /**
   * Generates HTML for initial hold button setup
   * @param {Object} options Button configuration options
   * @param {string} options.colorType Type of color
   * @param {string} options.targetId ID of the color element this button controls
   * @returns {string} Complete hold button HTML
   */
  static buildInitialHoldButton(options) {
    const { colorType, targetId } = options;

    return `
      <button class="hold-button"
              data-color-type="${colorType}"
              data-color-target="${targetId}"
              aria-pressed="false"
              aria-label="Lock ${colorType} colour">
          ${this.buildHoldButtonContent({ colorType, isHeld: false })}
      </button>
  `;
  }

  /**
   * Generates HTML for color hold status announcement
   * @param {string} colorType Type of color being held/released
   * @param {string} colorName Name of the color
   * @param {boolean} isHeld Whether the color is now held
   * @returns {string} Announcement HTML
   */
  static buildHoldStatusAnnouncement(colorType, colorName, isHeld) {
    return `
      <div class="sr-only" role="status" aria-live="polite">
          ${colorType} colour ${colorName} ${isHeld ? "held" : "released"}
      </div>
  `;
  }

  /**
   * Generates HTML for the disabled state message when background is locked
   * @param {string} elementName Name of the disabled element
   * @returns {string} Disabled state message HTML
   */
  static buildLockedStateMessage(elementName) {
    return `
      <span class="sr-only">
          ${elementName} - Unavailable while background colour is locked
      </span>
  `;
  }
}
