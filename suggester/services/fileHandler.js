import { ColorValidator } from '../utils/colorValidation.js';

export class FileHandler {
    /**
     * Handle JSON file upload
     * @param {File} file - The uploaded JSON file
     * @returns {Promise<Array>} Array of color objects
     * @throws {Error} If file is invalid
     */
    static async handleJsonUpload(file) {
        try {
            // Validate file type
            if (!file.name.toLowerCase().endsWith('.json')) {
                throw new Error('File must be a JSON file');
            }

            const text = await file.text();
            const colors = JSON.parse(text);

            // Validate the JSON structure
            if (!Array.isArray(colors)) {
                throw new Error('JSON must contain an array of colors');
            }

            // Validate each color object
            colors.forEach((color, index) => {
                if (!color.colourHex || !color.name) {
                    throw new Error(`Invalid color object at index ${index}. Each color must have 'colourHex' and 'name' properties`);
                }
                // Validate hex color format
                color.colourHex = ColorValidator.validateHex(color.colourHex);
            });

            return colors;
        } catch (error) {
            throw new Error(`JSON file processing failed: ${error.message}`);
        }
    }

    /**
     * Handle CSV file upload
     * @param {File} file - The uploaded CSV file
     * @returns {Promise<Array>} Array of color objects
     * @throws {Error} If file is invalid
     */
    static async handleCsvUpload(file) {
        try {
            // Validate file type
            if (!file.name.toLowerCase().endsWith('.csv')) {
                throw new Error('File must be a CSV file');
            }

            const text = await file.text();
            return this.parseCsvColors(text);
        } catch (error) {
            throw new Error(`CSV file processing failed: ${error.message}`);
        }
    }

    /**
     * Parse CSV text into color objects
     * @param {string} csvText - Raw CSV text
     * @returns {Array} Array of color objects
     * @throws {Error} If CSV format is invalid
     */
    static parseCsvColors(csvText) {
        // Split into lines and remove empty lines
        const lines = csvText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        // Try to determine CSV format
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('hex') || header.includes('name');
        const startIndex = hasHeader ? 1 : 0;

        // Process lines into color objects
        return lines.slice(startIndex).map((line, index) => {
            const parts = line.split(',').map(part => part.trim());
            
            if (parts.length === 0 || parts.length > 2) {
                throw new Error(`Invalid format in line ${index + 1}. Expected: "HEX,NAME" or "NAME,HEX"`);
            }

            let hexColor = '';
            let name = '';

            // Handle different CSV formats
            if (parts.length === 1) {
                // Format: HEX only
                hexColor = ColorValidator.validateHex(parts[0]);
                name = `Color ${index + 1}`;
            } else if (parts.length === 2) {
                // Determine which part is the hex color
                if (ColorValidator.isHexColor(parts[0])) {
                    // Format: HEX,NAME
                    hexColor = ColorValidator.validateHex(parts[0]);
                    name = parts[1] || `Color ${index + 1}`;
                } else if (ColorValidator.isHexColor(parts[1])) {
                    // Format: NAME,HEX
                    hexColor = ColorValidator.validateHex(parts[1]);
                    name = parts[0] || `Color ${index + 1}`;
                } else {
                    throw new Error(`No valid hex color found in line ${index + 1}`);
                }
            }

            return {
                colourHex: hexColor,
                name: name
            };
        });
    }

    /**
     * Read a file as text
     * @param {File} file - The file to read
     * @returns {Promise<string>} The file contents as text
     */
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }

    /**
     * Validate file size
     * @param {File} file - The file to validate
     * @param {number} maxSize - Maximum file size in bytes
     * @throws {Error} If file is too large
     */
    static validateFileSize(file, maxSize = 1024 * 1024) { // Default 1MB
        if (file.size > maxSize) {
            throw new Error(`File size exceeds maximum allowed size of ${maxSize / 1024}KB`);
        }
    }
}