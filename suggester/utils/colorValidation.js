/**
 * @fileoverview Color Validation Utility Class
 * 
 * This class provides utilities for validating color values and their metadata.
 * It ensures colors are properly formatted for:
 * - Consistent hex code formatting
 * - Valid color specifications
 * - Required metadata for accessibility
 * 
 * Accessibility Importance:
 * - Proper color validation is crucial for accurate contrast calculations
 * - Color names are required for screen reader announcements
 * - Standardized formats ensure reliable WCAG compliance checking
 */

export class ColorValidator {
    /**
     * Validates and standardizes a hex color code
     * Ensures consistent format for contrast calculations
     * 
     * @param {string} hex - The hex color code to validate
     * @returns {string} Standardized uppercase hex color code
     * @throws {Error} If the hex code is invalid
     * 
     * @example
     * // Returns "#FFFFFF"
     * ColorValidator.validateHex("#ffffff")
     * 
     * @example
     * // Returns "#FF0000"
     * ColorValidator.validateHex("ff0000")
     * 
     * @example
     * // Throws Error
     * ColorValidator.validateHex("not-a-color")
     */
    static validateHex(hex) {
        // Remove any whitespace
        hex = hex.replace(/\s/g, '');
        
        // Add # prefix if missing
        if (!hex.startsWith('#')) {
            hex = '#' + hex;
        }
        
        // Check for valid 6-digit hex format
        if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
            throw new Error(`Invalid hex color: ${hex}. Color must be in 6-digit hex format (e.g., #FF0000)`);
        }
        
        // Return standardized uppercase version
        return hex.toUpperCase();
    }

    /**
     * Checks if a string is a valid hex color code
     * Used for non-throwing validation checks
     * 
     * @param {string} str - The string to check
     * @returns {boolean} True if string is a valid hex color
     * 
     * @example
     * // Returns true
     * ColorValidator.isHexColor("#FF0000")
     * 
     * @example
     * // Returns false
     * ColorValidator.isHexColor("red")
     */
    static isHexColor(str) {
        // Remove any whitespace
        str = str.replace(/\s/g, '');
        
        // Add # prefix if missing
        if (!str.startsWith('#')) {
            str = '#' + str;
        }
        
        // Test for valid 6-digit hex format
        return /^#[0-9A-Fa-f]{6}$/.test(str);
    }

    /**
     * Validates an array of color objects for required fields and formats
     * Ensures all colors have proper metadata for accessibility
     * 
     * @param {Array<Object>} jsonData - Array of color objects to validate
     * @returns {boolean} True if all colors are valid
     * @throws {Error} If any validation fails
     * 
     * @example
     * // Returns true
     * ColorValidator.validateColorJson([
     *   {
     *     colourHex: "#FF0000",
     *     name: "Bright Red"
     *   }
     * ])
     * 
     * @example
     * // Throws Error
     * ColorValidator.validateColorJson([
     *   {
     *     colourHex: "#FF0000"
     *     // missing name field
     *   }
     * ])
     */
    static validateColorJson(jsonData) {
        // Ensure input is an array
        if (!Array.isArray(jsonData)) {
            throw new Error('Color data must be an array of color objects');
        }

        // Define required fields for each color object
        const requiredFields = ['colourHex', 'name'];

        // Validate each color object
        jsonData.forEach((color, index) => {
            // Check for required fields
            requiredFields.forEach(field => {
                if (!(field in color)) {
                    throw new Error(
                        `Missing required field '${field}' in color at index ${index}. ` +
                        `Each color must have both 'colourHex' and 'name' fields.`
                    );
                }
            });

            // Validate hex color format
            this.validateHex(color.colourHex);

            // Ensure color name is not empty
            if (!color.name.trim()) {
                throw new Error(
                    `Empty color name at index ${index}. ` +
                    `Each color must have a descriptive name for accessibility.`
                );
            }
        });

        return true;
    }

    /**
     * Suggested Addition: Validate color name for accessibility
     * Ensures color names are descriptive and screen-reader friendly
     * 
     * @param {string} name - Color name to validate
     * @returns {boolean} True if name is valid
     * @throws {Error} If name doesn't meet accessibility requirements
     */
    static validateColorName(name) {
        // Remove leading/trailing whitespace
        name = name.trim();

        // Check minimum length
        if (name.length < 3) {
            throw new Error(
                'Color name must be at least 3 characters long for clarity'
            );
        }

        // Check for descriptive name (not just hex code)
        if (/^#?[0-9A-Fa-f]{6}$/.test(name)) {
            throw new Error(
                'Color name must be descriptive, not just a hex code'
            );
        }

        return true;
    }

    /**
     * Suggested Addition: Validate contrast ratio
     * Helper method for checking if colors meet WCAG contrast requirements
     * 
     * @param {number} ratio - Contrast ratio to validate
     * @param {string} usage - Intended usage ('text' or 'graphics')
     * @returns {boolean} True if contrast meets WCAG requirements
     */
    static validateContrast(ratio, usage = 'text') {
        if (usage === 'text') {
            return ratio >= 4.5; // WCAG AA standard for regular text
        } else if (usage === 'graphics') {
            return ratio >= 3.0; // WCAG AA standard for graphics
        }
        throw new Error('Invalid usage type. Must be "text" or "graphics"');
    }
}