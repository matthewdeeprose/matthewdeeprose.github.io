/**
 * @module ContentProcessorTypes
 * @description TypeScript-like interfaces and types for content processors
 * 
 * Note: These are JSDoc comments to provide type information for IDEs and documentation
 * but don't affect runtime behavior as JavaScript doesn't have interfaces.
 */

/**
 * @typedef {Object} ProcessOptions
 * @property {boolean} [includeCodeHighlighting=true] - Whether to include code highlighting
 * @property {boolean} [processLists=true] - Whether to process lists
 * @property {boolean} [processTables=true] - Whether to process tables
 * @property {boolean} [processMath=true] - Whether to process math expressions
 */

/**
 * @typedef {Object} MathInfo
 * @property {string} content - The original math content
 * @property {number} offset - Position in the original text
 * @property {number} length - Length of the original text
 */

/**
 * @typedef {Object} TableAlignment
 * @property {string} align - Alignment value ('left', 'center', 'right')
 * @property {string} style - CSS style attribute value
 */

/**
 * @typedef {Object} ProcessedResult
 * @property {string} content - The processed content
 * @property {boolean} success - Whether processing was successful
 * @property {string} [error] - Error message if processing failed
 */

export const Types = {
  // This is just a namespace object to organize the types
  // The actual types are defined in JSDoc comments above
};