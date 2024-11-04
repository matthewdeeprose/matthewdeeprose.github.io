/**
 * @fileoverview Code Location Helper
 * Development utility to help identify where to insert new code by providing unique location IDs
 * 
 * This is a development-only utility and should not be included in production builds
 */

export class CodeLocationHelper {
	static locations = {
		// ColorChecker.js locations
		COLORCHECKER_CONSTRUCTOR: {
			file: 'colorChecker.js',
			searchFor: 'constructor() {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside ColorChecker constructor'
		},
		COLORCHECKER_INIT: {
			file: 'colorChecker.js',
			searchFor: 'async init() {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside ColorChecker init method'
		},
		COLORCHECKER_RANDOMALL: {
			file: 'colorChecker.js',
			searchFor: 'randomAll() {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside ColorChecker randomAll method'
		},

		// UIManager.js locations
		UIMANAGER_CONSTRUCTOR: {
			file: 'uiManager.js',
			searchFor: 'constructor(elements, colorStorage) {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside UIManager constructor'
		},
		UIMANAGER_UPDATEUI: {
			file: 'uiManager.js',
			searchFor: 'updateUI(',
			insertAfter: true,
			indentLevel: 1,
			description: 'Inside UIManager updateUI method'
		},
		// ColorStorage.js locations
		COLORSTORAGE_CONSTRUCTOR: {
			file: 'colorStorage.js',
			searchFor: 'constructor() {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside ColorStorage constructor'
		},
		COLORSTORAGE_LOADCOLORS: {
			file: 'colorStorage.js',
			searchFor: 'loadColors(colors) {',
			insertAfter: true,
			indentLevel: 2,
			description: 'Inside ColorStorage loadColors method'
		}
	};

	/**
	 * Format code for insertion at a specific location
	 * @param {string} locationId - ID from the locations object
	 * @param {string} newCode - Code to be inserted
	 * @returns {Object} Formatted insertion instructions
	 */
	static formatInsertion(locationId, newCode) {
		const location = this.locations[locationId];
		if (!location) {
			throw new Error(`Unknown location ID: ${locationId}`);
		}

		// Add indentation to each line
		const indent = ' '.repeat(location.indentLevel * 4);
		const formattedCode = newCode
			.split('\n')
			.map(line => line.trim() ? indent + line : line)
			.join('\n');

		return {
			file: location.file,
			searchPattern: location.searchFor,
			insertAfter: location.insertAfter,
			code: formattedCode,
			description: location.description
		};
	}

	/**
	 * Generate insertion instructions
	 * @param {string} locationId - ID from the locations object
	 * @param {string} newCode - Code to be inserted
	 * @returns {string} Human-readable insertion instructions
	 */
	static generateInstructions(locationId, newCode) {
		const insertion = this.formatInsertion(locationId, newCode);

		return `
INSERT INTO: ${insertion.file}
FIND THIS LINE: ${insertion.searchFor}
${insertion.insertAfter ? 'INSERT AFTER' : 'INSERT BEFORE'} THAT LINE:

${insertion.code}

DESCRIPTION: ${insertion.description}
`;
	}
}