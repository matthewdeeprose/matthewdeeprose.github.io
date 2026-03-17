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
    // Core Colours
    // The foundation of the University of Southampton brand
    { "colourHex": "#fafafa", "name": "White" },
    { "colourHex": "#002f4c", "name": "Marine Blue" },
    { "colourHex": "#005c84", "name": "University Blue" },

    // Wider Blues
    // Extended blue palette for flexibility across the brand
    { "colourHex": "#003784", "name": "Midnight Blue" },
    { "colourHex": "#0265ca", "name": "Vibrant Blue" },
    { "colourHex": "#68b9e8", "name": "Mid Blue" },
    { "colourHex": "#91dcf4", "name": "Sky Blue" },
    { "colourHex": "#cbebfd", "name": "Light Blue" },
    { "colourHex": "#00ddff", "name": "Digital Blue" },

    // Neutral Palette - Black
    { "colourHex": "#111111", "name": "Black" },

    // Warm Neutrals
    // Warm tones for softening layouts and creating hierarchy
    { "colourHex": "#3e3836", "name": "Warm Neutral 01" },  // Darkest
    { "colourHex": "#706b69", "name": "Warm Neutral 02" },
    { "colourHex": "#b3a59d", "name": "Warm Neutral 03" },
    { "colourHex": "#d1c6c0", "name": "Warm Neutral 04" },
    { "colourHex": "#ece6e1", "name": "Warm Neutral 05" },
    { "colourHex": "#fbf9f7", "name": "Warm Neutral 06" },  // Lightest

    // Cool Neutrals
    // Cool tones complementing the blue brand palette
    { "colourHex": "#495961", "name": "Cool Neutral 01" },  // Darkest
    { "colourHex": "#758d9a", "name": "Cool Neutral 02" },
    { "colourHex": "#9eb1bd", "name": "Cool Neutral 03" },
    { "colourHex": "#e1e8ec", "name": "Cool Neutral 04" },
    { "colourHex": "#f5f5f5", "name": "Cool Neutral 05" },  // Lightest

    // Marine Colour Family
    // Inspired by the ocean and marine landscapes of Southampton
    { "colourHex": "#00403e", "name": "Marine 01" },   // Darkest
    { "colourHex": "#0c838c", "name": "Marine 02" },
    { "colourHex": "#00b0b3", "name": "Marine 03" },
    { "colourHex": "#83dbd2", "name": "Marine 04" },
    { "colourHex": "#c9f7f0", "name": "Marine 05" },   // Lightest
    { "colourHex": "#00ffae", "name": "Digital Marine" },

    // Forest Colour Family
    // Inspired by the verdant green surroundings of campus
    { "colourHex": "#01530d", "name": "Forest 01" },   // Darkest
    { "colourHex": "#0c8c41", "name": "Forest 02" },
    { "colourHex": "#8bd100", "name": "Forest 03" },
    { "colourHex": "#83db8c", "name": "Forest 04" },
    { "colourHex": "#d4f7c9", "name": "Forest 05" },   // Lightest
    { "colourHex": "#cfff00", "name": "Digital Forest" },

    // Horizon Colour Family
    // Warmth and energy inspired by the sun
    { "colourHex": "#5a0202", "name": "Horizon 01" },  // Darkest
    { "colourHex": "#e63037", "name": "Horizon 02" },
    { "colourHex": "#ef7d00", "name": "Horizon 03" },
    { "colourHex": "#fcbc00", "name": "Horizon 04" },
    { "colourHex": "#fff4dd", "name": "Horizon 05" },  // Lightest
    { "colourHex": "#fbfc00", "name": "Digital Horizon" },

    // Amethyst Colour Family
    // Depth and vibrancy for the extended palette
    { "colourHex": "#6c0370", "name": "Amethyst 01" },  // Darkest
    { "colourHex": "#d500a0", "name": "Amethyst 02" },
    { "colourHex": "#ea42cb", "name": "Amethyst 03" },
    { "colourHex": "#db83d4", "name": "Amethyst 04" },
    { "colourHex": "#ece1ec", "name": "Amethyst 05" },  // Lightest
    { "colourHex": "#ff34d3", "name": "Digital Amethyst" }
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