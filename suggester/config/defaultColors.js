/**
 * @fileoverview Default Corporate Brand Color Palette Configuration
 * 
 * This file defines the organization's brand color palette used for accessible
 * color combinations. The palette includes:
 * - Base colors (white and blacks)
 * - Neutral grays
 * - Marine blues and teals
 * - Horizon warm colors
 * 
 * Accessibility Considerations:
 * - Colors are carefully selected to provide sufficient contrast combinations
 * - Includes a range of light and dark options for flexibility
 * - Neutral colors support readable text on various backgrounds
 * 
 * Color Format:
 * @typedef {Object} ColorDefinition
 * @property {string} colourHex - The color in hexadecimal format (#RRGGBB)
 * @property {string} name - Human-readable name for the color
 */

export const defaultColors = [
    // Base Colors
    // White is essential for high-contrast combinations
    { "colourHex": "#FFFFFF", "name": "White" },
    
    // Black Variants
    // Multiple black options provide flexibility for different contrast needs
    { "colourHex": "#231F20", "name": "Plain Black" },
    { "colourHex": "#00131D", "name": "Rich Black" },
    
    // Neutral Gray Scale
    // Neutral colors are crucial for creating hierarchy without being distracting
    { "colourHex": "#495961", "name": "Neutral 1" },  // Darkest neutral
    { "colourHex": "#758D9A", "name": "Neutral 2" },
    { "colourHex": "#9FB1BD", "name": "Neutral 3" },
    { "colourHex": "#E1E8EC", "name": "Neutral 4" },  // Lightest neutral
    
    // Marine Color Family
    // Cool blues and teals for primary brand elements
    { "colourHex": "#002E3B", "name": "Prussian" },   // Dark blue base
    { "colourHex": "#005C84", "name": "Marine 1" },
    { "colourHex": "#74C9E5", "name": "Marine 2" },
    { "colourHex": "#3CBAC6", "name": "Marine 3" },
    { "colourHex": "#B3DBD2", "name": "Marine 4" },
    { "colourHex": "#4BB694", "name": "Marine 5" },
    { "colourHex": "#1E8765", "name": "Shamrock" },
    { "colourHex": "#C1D100", "name": "Marine 6" },   // Accent color
    
    // Horizon Color Family
    // Warm accent colors for highlighting and emphasis
    { "colourHex": "#FCBC00", "name": "Horizon 1" },  // Gold
    { "colourHex": "#EF7D00", "name": "Horizon 2" },  // Orange
    { "colourHex": "#E73037", "name": "Horizon 3" },  // Red
    { "colourHex": "#E73238", "name": "Coral" },      // Bright red
    { "colourHex": "#D5007F", "name": "Horizon 4" },  // Magenta
    { "colourHex": "#8D3970", "name": "Horizon 5" }   // Purple
];

/**
 * Color Accessibility Notes:
 * 
 * 1. Light on Dark Combinations:
 *    - White (#FFFFFF) works well on dark blues like Prussian (#002E3B)
 *    - Light neutrals (Neutral 4) provide good contrast on dark backgrounds
 * 
 * 2. Dark on Light Combinations:
 *    - Rich Black (#00131D) provides excellent contrast on light backgrounds
 *    - Dark blues (Marine 1) can work well on light neutral backgrounds
 * 
 * 3. Supporting Colors:
 *    - Neutral grays can be used for secondary text and UI elements
 *    - Horizon colors should be used sparingly and tested for contrast
 * 
 * 4. Color Blindness Considerations:
 *    - The palette includes colors that remain distinguishable
 *      for common forms of color blindness
 *    - Value contrast helps maintain readability regardless of color perception
 */