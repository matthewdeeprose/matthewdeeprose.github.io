/**
 * @fileoverview File Handler for Color Palette Imports
 * 
 * This class handles the import of color palettes from JSON and CSV files.
 * It includes validation to ensure:
 * - Proper file formats
 * - Valid color hex codes
 * - Required color metadata
 * - Reasonable file sizes
 * 
 * Accessibility Considerations:
 * - Validates hex colors for proper format to ensure reliable contrast checking
 * - Requires color names for better screen reader experience
 * - Provides clear error messages for better user feedback
 */

import { ColorValidator } from '../utils/colorValidation.js';

export class FileHandler {
    /**
     * Initializes file upload handlers with UI update callback
     * @param {Object} options Configuration object
     * @param {Object} options.colorStorage Reference to ColorStorage instance
     * @param {Object} options.uiManager Reference to UIManager instance
     */
    static initFileUploads(options) {
        const jsonInput = document.getElementById('jsonFileInput');
        const csvInput = document.getElementById('csvFileInput');

        // Set up JSON file upload handler
        if (jsonInput) {
            jsonInput.addEventListener('change', async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;

                    FileHandler.validateFileSize(file);
                    const colors = await FileHandler.handleJsonUpload(file);
                    const stats = options.colorStorage.loadColors(colors);
                    
                    options.uiManager.displayUploadStats(stats);
                    options.uiManager.clearError();
                    
                    // Update color management UI with new colors
                    options.uiManager.updateColorManagementUI(
                        options.colorStorage.colors,
                        options.colorStorage.activeColors,
                        (colorHex) => {
                            const stats = options.colorStorage.toggleColor(colorHex);
                            options.uiManager.displayUploadStats(stats);
                        },
                        (active) => {
                            const stats = options.colorStorage.toggleAllColors(active);
                            options.uiManager.displayUploadStats(stats);
                        }
                    );

                    // Reset file input
                    e.target.value = '';
                } catch (error) {
                    options.uiManager.displayError(error.message);
                }
            });
        }

        // Set up CSV file upload handler
        if (csvInput) {
            csvInput.addEventListener('change', async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) return;

                    FileHandler.validateFileSize(file);
                    const colors = await FileHandler.handleCsvUpload(file);
                    const stats = options.colorStorage.loadColors(colors);
                    
                    options.uiManager.displayUploadStats(stats);
                    options.uiManager.clearError();
                    
                    // Update color management UI with new colors
                    options.uiManager.updateColorManagementUI(
                        options.colorStorage.colors,
                        options.colorStorage.activeColors,
                        (colorHex) => {
                            const stats = options.colorStorage.toggleColor(colorHex);
                            options.uiManager.displayUploadStats(stats);
                        },
                        (active) => {
                            const stats = options.colorStorage.toggleAllColors(active);
                            options.uiManager.displayUploadStats(stats);
                        }
                    );

                    // Reset file input
                    e.target.value = '';
                } catch (error) {
                    options.uiManager.displayError(error.message);
                }
            });
        }
    }

    /**
     * Processes a JSON file containing color definitions
     * @param {File} file Uploaded JSON file
     * @returns {Promise<Array<{colourHex: string, name: string}>>} Array of validated color objects
     * @throws {Error} If file format or content is invalid
     * 
     * Expected JSON format:
     * [
     *   {
     *     "colourHex": "#FFFFFF",
     *     "name": "White"
     *   },
     *   ...
     * ]
     */
    static async handleJsonUpload(file) {
        try {
            // Ensure file has .json extension
            if (!file.name.toLowerCase().endsWith('.json')) {
                throw new Error('File must be a JSON file');
            }

            // Read file content as text
            const text = await file.text();
            const colors = JSON.parse(text);

            // JSON must contain an array of colors
            if (!Array.isArray(colors)) {
                throw new Error('JSON must contain an array of colors');
            }

            // Validate each color object in the array
            colors.forEach((color, index) => {
                // Check for required properties
                if (!color.colourHex || !color.name) {
                    throw new Error(
                        `Invalid color object at index ${index}. ` +
                        `Each color must have 'colourHex' and 'name' properties`
                    );
                }
                // Validate and standardize hex color format
                color.colourHex = ColorValidator.validateHex(color.colourHex);
            });

            return colors;
        } catch (error) {
            throw new Error(`JSON file processing failed: ${error.message}`);
        }
    }

    /**
     * Processes a CSV file containing color definitions
     * @param {File} file Uploaded CSV file
     * @returns {Promise<Array<{colourHex: string, name: string}>>} Array of validated color objects
     * @throws {Error} If file format or content is invalid
     * 
     * Supported CSV formats:
     * 1. HEX,NAME
     * 2. NAME,HEX
     * 3. HEX (names will be auto-generated)
     */
    static async handleCsvUpload(file) {
        try {
            // Ensure file has .csv extension
            if (!file.name.toLowerCase().endsWith('.csv')) {
                throw new Error('File must be a CSV file');
            }

            // Read and parse CSV content
            const text = await file.text();
            return this.parseCsvColors(text);
        } catch (error) {
            throw new Error(`CSV file processing failed: ${error.message}`);
        }
    }

    /**
     * Parses CSV text into color objects
     * Handles multiple CSV formats and includes format auto-detection
     * @param {string} csvText Raw CSV text content
     * @returns {Array<{colourHex: string, name: string}>} Array of validated color objects
     * @throws {Error} If CSV format is invalid
     */
    static parseCsvColors(csvText) {
        // Split into lines, clean up whitespace, and remove empty lines
        const lines = csvText.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        if (lines.length === 0) {
            throw new Error('CSV file is empty');
        }

        // Check first line for header row
        const header = lines[0].toLowerCase();
        const hasHeader = header.includes('hex') || header.includes('name');
        const startIndex = hasHeader ? 1 : 0;

        // Process each line into a color object
        return lines.slice(startIndex).map((line, index) => {
            const parts = line.split(',').map(part => part.trim());
            
            // Validate line format
            if (parts.length === 0 || parts.length > 2) {
                throw new Error(
                    `Invalid format in line ${index + 1}. ` +
                    `Expected: "HEX,NAME" or "NAME,HEX"`
                );
            }

            let hexColor = '';
            let name = '';

            // Handle different CSV formats
            if (parts.length === 1) {
                // Single column format: HEX only
                hexColor = ColorValidator.validateHex(parts[0]);
                name = `Color ${index + 1}`; // Auto-generate name
            } else if (parts.length === 2) {
                // Two column format: Detect which column is the hex color
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

            return { colourHex: hexColor, name: name };
        });
    }

    /**
     * Validates file size against maximum allowed size
     * @param {File} file File to validate
     * @param {number} maxSize Maximum allowed size in bytes (default: 1MB)
     * @throws {Error} If file exceeds maximum size
     */
    static validateFileSize(file, maxSize = 1024 * 1024) {
        if (file.size > maxSize) {
            throw new Error(
                `File size exceeds maximum allowed size of ${maxSize / 1024}KB`
            );
        }
    }

    /**
     * Reads a file and returns its contents as text
     * @param {File} file File to read
     * @returns {Promise<string>} File contents as text
     */
    static readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }
}