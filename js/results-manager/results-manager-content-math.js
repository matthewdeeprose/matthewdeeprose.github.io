/**
 * @module MathContentProcessor
 * @description Processes mathematical expressions and protects currency values
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";

export class MathContentProcessor extends ContentProcessorBase {
  /**
   * Create a new MathContentProcessor instance
   * @param {ContentProcessorState} state - Shared processor state
   */
  constructor(state) {
    super();
    this.state = state;
    this.utils.log("Math content processor initialized");
  }

  /**
   * Process math expressions in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with math placeholders
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing math expressions and currency values");

      // First, protect currency values
      const processedWithCurrency = this.protectCurrencyValues(content);

      // Then process math expressions
      const processedWithMath = this.processMathExpressions(
        processedWithCurrency
      );

      return processedWithMath;
    } catch (error) {
      this.utils.log("Error processing math expressions", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Restore math expressions and currency values after processing
   * @param {string} content - Processed content with math placeholders
   * @returns {string} Content with math expressions restored
   */
  restore(content) {
    if (!content) return "";

    try {
      this.utils.log("Restoring math expressions and currency values");

      // First restore math expressions
      const contentWithMath = this.restoreMathExpressions(content);

      // Then restore currency values
      const contentWithCurrency = this.restoreCurrencyValues(contentWithMath);

      return contentWithCurrency;
    } catch (error) {
      this.utils.log("Error restoring math expressions", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Process mathematical expressions
   * @param {string} content - Content to process
   * @returns {string} Content with math expressions replaced with placeholders
   */
  processMathExpressions(content) {
    this.utils.log("Processing math expressions");

    try {
      // Replace inline math expressions with placeholders
      let inlineMathCount = 0;

      // Process display math expressions first (double dollar signs)
      let processedContent = content.replace(
        /\$\$([\s\S]+?)\$\$/g,
        (match, expr, offset, string) => {
          // Skip if within table cell
          if (this.isWithinTableCell(string, offset)) {
            return match;
          }

          const placeholder = `__BLOCK_MATH_${inlineMathCount++}__`;
          // Store the placeholder with context information
          this.state.blockMathPlaceholders.set(placeholder, {
            content: match,
            offset: offset,
            length: match.length,
          });

          this.utils.log("Found block math expression", {
            expression: match.substring(0, 20) + "...",
            placeholder,
          });
          return placeholder;
        }
      );

      // Then process inline math expressions (single dollar signs)
      inlineMathCount = 0; // Reset counter for inline expressions
      processedContent = processedContent.replace(
        /\$([\s\S]+?)\$/g,
        (match, expr, offset, string) => {
          // Skip if within table cell
          if (this.isWithinTableCell(string, offset)) {
            return match;
          }

          const placeholder = `__INLINE_MATH_${inlineMathCount++}__`;
          // Store the placeholder with context information
          this.state.inlineMathPlaceholders.set(placeholder, {
            content: match,
            offset: offset,
            length: match.length,
          });

          this.utils.log("Found inline math expression", {
            expression: match,
            placeholder,
          });
          return placeholder;
        }
      );

      return processedContent;
    } catch (error) {
      this.utils.log("Error processing math expressions", { error }, "error");
      return content;
    }
  }

  /**
   * Restore math expressions after Markdown processing
   * @param {string} content - Processed content with math placeholders
   * @returns {string} Content with math expressions restored
   */
  restoreMathExpressions(content) {
    this.utils.log("Restoring math expressions");

    try {
      let processedContent = content;

      // Check for bold or italic formatting around placeholders - this happens sometimes
      // Handle inline math placeholders with formatting
      const inlineBoldPattern = /<strong>INLINE_?MATH_(\d+)<\/strong>/g;
      const inlineItalicPattern = /<em>INLINE_?MATH_(\d+)<\/em>/g;
      const inlineMixedPattern = /<strong>INLINE<em>MATH<\/em>(\d+)<\/strong>/g;

      // Handle block math placeholders with formatting
      const blockBoldPattern = /<strong>BLOCK_?MATH_(\d+)<\/strong>/g;
      const blockItalicPattern = /<em>BLOCK_?MATH_(\d+)<\/em>/g;
      const blockMixedPattern = /<strong>BLOCK<em>MATH<\/em>(\d+)<\/strong>/g;

      // Replace formatted inline math placeholders
      processedContent = processedContent.replace(
        inlineMixedPattern,
        (match, index) => {
          const placeholder = `__INLINE_MATH_${index}__`;
          const mathInfo = this.state.inlineMathPlaceholders.get(placeholder);
          return mathInfo ? mathInfo.content : match;
        }
      );

      // Replace formatted block math placeholders
      processedContent = processedContent.replace(
        blockMixedPattern,
        (match, index) => {
          const placeholder = `__BLOCK_MATH_${index}__`;
          const mathInfo = this.state.blockMathPlaceholders.get(placeholder);
          return mathInfo ? mathInfo.content : match;
        }
      );

      // Also check for the regular placeholders without formatting
      const inlinePlaceholderPattern = /__INLINE_MATH_(\d+)__/g;
      const blockPlaceholderPattern = /__BLOCK_MATH_(\d+)__/g;

      // Replace regular inline math placeholders
      processedContent = processedContent.replace(
        inlinePlaceholderPattern,
        (match) => {
          const mathInfo = this.state.inlineMathPlaceholders.get(match);
          return mathInfo ? mathInfo.content : match;
        }
      );

      // Replace regular block math placeholders
      processedContent = processedContent.replace(
        blockPlaceholderPattern,
        (match) => {
          const mathInfo = this.state.blockMathPlaceholders.get(match);
          return mathInfo ? mathInfo.content : match;
        }
      );

      return processedContent;
    } catch (error) {
      this.utils.log("Error restoring math expressions", { error }, "error");
      return content;
    }
  }

  /**
   * Protect currency values from being processed as math expressions
   * @param {string} content - Content to process
   * @returns {string} Content with currency values protected
   */
  protectCurrencyValues(content) {
    this.utils.log("Protecting currency values");

    try {
      // Clear existing currency placeholders
      this.state.currencyPlaceholders.clear();
      let currencyCount = 0;

      // Enhanced regex for currency patterns - look for $ followed by digits, possibly with commas and decimal points
      // This pattern is more specific to reduce false positives with math expressions
      const currencyRegex = /\$\s*\d+(?:,\d{3})*(?:\.\d{1,2})?|\$\s*\.\d{1,2}/g;

      // Replace currency values with placeholders
      const processedContent = content.replace(
        currencyRegex,
        (match, offset) => {
          // Check if this looks like a math expression
          const isMathExpr = this.looksLikeMathExpression(content, offset);
          if (isMathExpr) {
            return match; // Leave it alone if it looks like math
          }

          const placeholder = `__CURRENCY_${currencyCount++}__`;
          this.state.currencyPlaceholders.set(placeholder, match);

          this.utils.log("Protected currency value", {
            original: match,
            placeholder,
            isInTable: this.isWithinTableCell(content, offset),
          });
          return placeholder;
        }
      );

      return processedContent;
    } catch (error) {
      this.utils.log("Error protecting currency values", { error }, "error");
      return content;
    }
  }

  /**
   * Check if a dollar sign at the given position likely indicates a math expression
   * @param {string} content - Full content
   * @param {number} offset - Position of the dollar sign
   * @returns {boolean} True if this appears to be a math expression
   */
  looksLikeMathExpression(content, offset) {
    // Get context around the dollar sign
    const prefixStart = Math.max(0, offset - 5);
    const suffixEnd = Math.min(content.length, offset + 20);

    const prefix = content.substring(prefixStart, offset);
    const suffix = content.substring(offset + 1, suffixEnd);

    // Math expressions often have math symbols, variables, or functions
    const mathSymbols = /[+\-*/^=(){}[\]\\]|sin|cos|tan|log|sqrt/;

    // Check if there's a matching closing $ in the suffix
    const hasClosingDollar = suffix.includes("$");

    // If suffix has math symbols or surrounding text looks like math context
    return mathSymbols.test(suffix) || hasClosingDollar;
  }

  /**
   * Restore protected currency values
   * @param {string} content - Content with currency placeholders
   * @returns {string} Content with currency values restored
   */
  restoreCurrencyValues(content) {
    this.utils.log("Restoring currency values", {
      placeholderCount: this.state.currencyPlaceholders.size,
    });

    try {
      let processedContent = content;

      // IMPORTANT NEW CODE: First check for various malformed placeholder formats
      // Look for <strong>CURRENCY_X</strong> pattern (happens in tables)
      processedContent = processedContent.replace(
        /<strong>CURRENCY_(\d+)<\/strong>/g,
        (match, index) => {
          // Look up the original value by index
          let originalValue = null;
          this.state.currencyPlaceholders.forEach((value, key) => {
            const keyIndexMatch = key.match(/__CURRENCY_(\d+)__/);
            if (
              keyIndexMatch &&
              parseInt(keyIndexMatch[1], 10) === parseInt(index, 10)
            ) {
              originalValue = value;
            }
          });

          this.utils.log("Restored malformed currency placeholder in table", {
            match,
            index,
            originalValue,
          });

          return originalValue || match;
        }
      );

      // Now handle normal placeholders
      this.state.currencyPlaceholders.forEach((value, placeholder) => {
        const escapedPlaceholder = placeholder.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&"
        );
        const placeholderRegex = new RegExp(escapedPlaceholder, "g");
        processedContent = processedContent.replace(placeholderRegex, value);
      });

      // Additional check for any remaining CURRENCY_X pattern without underscores
      processedContent = processedContent.replace(
        /CURRENCY_(\d+)/g,
        (match, index) => {
          // Look up by index
          let originalValue = null;
          this.state.currencyPlaceholders.forEach((value, key) => {
            const keyIndexMatch = key.match(/__CURRENCY_(\d+)__/);
            if (
              keyIndexMatch &&
              parseInt(keyIndexMatch[1], 10) === parseInt(index, 10)
            ) {
              originalValue = value;
            }
          });

          return originalValue || match;
        }
      );

      return processedContent;
    } catch (error) {
      this.utils.log("Error restoring currency values", { error }, "error");
      return content;
    }
  }

  /**
   * Check if a position is within a table cell
   * @param {string} content - The full content
   * @param {number} position - Position to check
   * @returns {boolean} True if position is within a table cell
   */
  isWithinTableCell(content, position) {
    try {
      const lastNewline = content.lastIndexOf("\n", position);
      const nextNewline = content.indexOf("\n", position);

      const line = content.substring(
        lastNewline === -1 ? 0 : lastNewline + 1,
        nextNewline === -1 ? content.length : nextNewline
      );

      return line.includes("|");
    } catch (error) {
      this.utils.log(
        "Error checking if position is within table cell",
        { error },
        "error"
      );
      return false;
    }
  }
}
