/**
 * @module ContentProcessorState
 * @description Shared state management for content processors
 */
import { ResultsManagerUtils } from "./results-manager-utils.js";

export class ContentProcessorState {
  constructor() {
    this.utils = new ResultsManagerUtils();
    
    // State for math expressions
    this.inlineMathPlaceholders = new Map();
    this.blockMathPlaceholders = new Map();
    
    // State for currency protection
    this.currencyPlaceholders = new Map();
    
    this.utils.log("Content processor state initialized");
  }

  /**
   * Get current state for serialization or debugging
   * @returns {Object} Current state object
   */
  getState() {
    return {
      inlineMathPlaceholders: Array.from(this.inlineMathPlaceholders.entries()),
      blockMathPlaceholders: Array.from(this.blockMathPlaceholders.entries()),
      currencyPlaceholders: Array.from(this.currencyPlaceholders.entries())
    };
  }

  /**
   * Reset state to initial values
   */
  reset() {
    this.inlineMathPlaceholders.clear();
    this.blockMathPlaceholders.clear();
    this.currencyPlaceholders.clear();
    this.utils.log("Content processor state reset");
  }
}