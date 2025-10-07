import { CONFIG } from "../config.js";
import { a11y } from "../accessibility-helpers.js";
/**
 * @fileoverview Request Handler Module
 * Coordinates request processing, caching, retries, and token tracking
 * using the modular token counter system.
 */

import { tokenCounter } from "../token-counter/token-counter-index.js";
import { modelRegistry } from "../model-registry/model-registry-index.js";
import { RetryManager } from "./request-handler-retry-manager.js";
import { CacheManager } from "./request-handler-cache-manager.js";
import { ModelFallbackManager } from "./request-handler-model-fallback.js";
import { RequestValidator } from "./request-handler-request-validator.js";

export class RequestHandler {
  constructor() {
    this.retryManager = new RetryManager();
    this.cacheManager = new CacheManager();
    this.fallbackManager = new ModelFallbackManager();
    this.validator = new RequestValidator();
    this.currentRequestId = null;
  }

  async executeRequest(messages, options, fetchFn) {
    // Initialize request tracking
    this.currentRequestId = tokenCounter.generateRequestId();
    tokenCounter.initializeRequest(
      this.currentRequestId,
      options.model,
      messages
    );

    // Validate request
    const validation = this.validator.validateRequest(messages, options);
    if (!validation.isValid) {
      a11y.announceStatus("Invalid request parameters", "assertive");
      throw new Error(validation.errors.join(", "));
    }

    // Check cache
    const cachedResponse = this.cacheManager.get(messages, options.model);
    if (cachedResponse) {
      a11y.announceStatus("Retrieved response from cache", "polite");
      return { ...cachedResponse, cached: true };
    }

    try {
      a11y.announceStatus("Sending request to API...", "polite");
      const response = await fetchFn(messages, options);

      // Record successful attempt
      tokenCounter.recordAttempt(
        this.currentRequestId,
        response.usage,
        options.model,
        false
      );

      this.cacheManager.set(messages, options.model, response);
      return response;
    } catch (error) {
      // Record failed attempt
      tokenCounter.recordAttempt(
        this.currentRequestId,
        null,
        options.model,
        false,
        error
      );

      if (this.fallbackManager.shouldSwitchModel(error)) {
        const fallbackModel = this.fallbackManager.getFallbackModel(
          options.model,
          error
        );
        if (fallbackModel) {
          options.model = fallbackModel;
          return this.executeRequest(messages, options, fetchFn);
        }
      }

      return this.retryManager.handleRetry(error, messages, options);
    }
  }
}

export const requestHandler = new RequestHandler();
