/**
 * @fileoverview Token Estimator
 * Provides token estimation functionality with support for different content types
 * and message roles. Uses heuristic-based estimation for improved accuracy.
 */

import { TokenLogger } from "./token-counter-logger.js";
import { TokenCounterError, ErrorCodes } from "./token-counter-error-types.js";
import { DEFAULT_CONFIG } from "./token-counter-defaults.js";

/**
 * TokenEstimator class
 * Handles token estimation for different types of content
 */
export class TokenEstimator {
  /**
   * Create a new TokenEstimator instance
   */
  constructor() {
    this.logger = TokenLogger;
    this.config = DEFAULT_CONFIG.estimation;
  }

  /**
   * Estimate total tokens for a set of messages
   *
   * @param {Array<Object>} messages - Array of message objects
   * @returns {number} Estimated total token count
   * @throws {TokenCounterError} If estimation fails
   */
  estimateTokens(messages) {
    this.logger.log("estimator", "Starting token estimation", { messages });

    try {
      // Start with base system overhead
      let totalEstimate = this.config.baseSystemOverhead;

      // Process each message
      const estimates = messages.map((msg) => this.estimateMessage(msg));
      totalEstimate += estimates.reduce((sum, est) => sum + est.total, 0);

      this.logger.log("estimator", "Estimation complete", {
        messageEstimates: estimates,
        totalEstimate,
      });

      return totalEstimate;
    } catch (error) {
      throw new TokenCounterError(
        "Token estimation failed",
        ErrorCodes.ESTIMATION,
        { messages, error: error.message }
      );
    }
  }

  /**
   * Estimate tokens for a single message
   *
   * @private
   * @param {Object} message - Message object to estimate
   * @returns {Object} Detailed estimation results
   */
  estimateMessage(message) {
    const { role = "user", content = "" } = message;

    // Get role-specific token count
    const roleTokens =
      this.config.roleTokens[role] || this.config.roleTokens.default;

    let estimate = {
      role,
      roleTokens,
      contentTokens: 0,
      specialTokens: 0,
      total: roleTokens,
    };

    // Handle complex content structures (e.g., messages with images)
    let processedContent = "";
    let imageTokenOverhead = 0;

    if (typeof content === "string") {
      // Simple string content
      processedContent = content;
    } else if (Array.isArray(content)) {
      // Complex content array (text + images)
      this.logger.log("estimator", "Processing complex content array", {
        contentItems: content.length,
      });

      // Extract text from content array
      const textItems = content.filter((item) => item.type === "text");
      processedContent = textItems.map((item) => item.text || "").join(" ");

      // Count images and add token overhead
      const imageItems = content.filter(
        (item) => item.type === "image_url" || item.type === "image"
      );

      if (imageItems.length > 0) {
        // Images typically use ~85 tokens for processing overhead
        imageTokenOverhead = imageItems.length * 85;
        this.logger.log("estimator", "Added image token overhead", {
          imageCount: imageItems.length,
          overhead: imageTokenOverhead,
        });
      }
    } else {
      // Fallback for unexpected content types
      this.logger.log(
        "estimator",
        "Unexpected content type, using string conversion",
        {
          contentType: typeof content,
        }
      );
      processedContent = String(content || "");
    }

    // Handle system prompts specially
    if (role === "system") {
      estimate = this.estimateSystemPrompt(processedContent, estimate);
    } else {
      estimate = this.estimateStandardContent(processedContent, estimate);
    }

    // Add image token overhead to special tokens
    estimate.specialTokens += imageTokenOverhead;
    estimate.total += imageTokenOverhead;

    this.logger.log("estimator", "Message estimation", estimate);
    return estimate;
  }

  /**
   * Estimate tokens for system prompt content
   *
   * @private
   * @param {string} content - System prompt content
   * @param {Object} estimate - Current estimation object
   * @returns {Object} Updated estimation
   */
  estimateSystemPrompt(content, estimate) {
    const words = content.split(/\s+/).filter((w) => w.length > 0);

    // Calculate word tokens with technical term consideration
    const wordTokens = words.reduce((total, word) => {
      const length = word.length;

      if (length <= 2) return total + this.config.wordMultipliers.short;
      if (length <= 4) return total + this.config.wordMultipliers.medium;
      if (length <= 8) return total + this.config.wordMultipliers.long;
      return total + Math.ceil(length / this.config.wordMultipliers.default);
    }, 0);

    // Check for special content
    const hasCodeBlocks = /```[\s\S]*?```/.test(content);
    const hasJsonSchema = /{[\s\S]*?}/.test(content);

    // Add special content tokens
    let specialTokens = 0;
    if (hasCodeBlocks) specialTokens += this.config.specialContent.codeBlock;
    if (hasJsonSchema) specialTokens += this.config.specialContent.jsonSchema;

    estimate.contentTokens = Math.ceil(wordTokens);
    estimate.specialTokens = specialTokens;
    estimate.total += estimate.contentTokens + estimate.specialTokens;

    return estimate;
  }

  /**
   * Estimate tokens for standard message content
   *
   * @private
   * @param {string} content - Message content
   * @param {Object} estimate - Current estimation object
   * @returns {Object} Updated estimation
   */
  estimateStandardContent(content, estimate) {
    const words = content.split(/\s+/).filter((w) => w.length > 0);

    // Calculate word tokens
    const wordTokens = words.reduce((total, word) => {
      const length = word.length;

      if (length <= 2) return total + 1; // Short words
      if (length <= 6) return total + 1; // Medium words
      return total + Math.ceil(length / 4); // Longer words
    }, 0);

    // Count special characters
    const specialChars = (content.match(/[.,!?;:'"()\[\]{}]/g) || []).length;
    const specialCharTokens = Math.ceil(specialChars / 2);

    // Add message formatting tokens
    const formattingTokens = this.config.specialContent.messageSeparator;

    estimate.contentTokens = wordTokens + specialCharTokens;
    estimate.specialTokens = formattingTokens;
    estimate.total += estimate.contentTokens + estimate.specialTokens;

    return estimate;
  }

  /**
   * Estimate tokens for a specific text snippet
   *
   * @param {string} text - Text to estimate
   * @param {Object} options - Estimation options
   * @returns {number} Estimated token count
   */
  estimateSnippet(text, options = {}) {
    const { role = "user" } = options;

    return this.estimateMessage({
      role,
      content: text,
    }).total;
  }
}

// Export singleton instance
export const estimator = new TokenEstimator();
