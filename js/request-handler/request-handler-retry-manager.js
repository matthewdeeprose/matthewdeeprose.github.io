import { a11y } from "../accessibility-helpers.js";
import { CONFIG } from "../config.js";

export class RetryManager {
  constructor() {
    this.retryCount = 0;
    this.maxRetries = CONFIG.MAX_RETRIES || 3;
    this.baseDelay = CONFIG.RETRY_BASE_DELAY || 1000;
  }

  calculateBackoff() {
    return this.baseDelay * Math.pow(2, this.retryCount);
  }

  async handleRetry(error, messages, options) {
    if (this.retryCount >= this.maxRetries) {
      a11y.announceStatus("Maximum retries reached", "assertive");
      throw new Error("Maximum retries reached");
    }

    const delay = this.calculateBackoff();
    a11y.announceStatus(`Retrying in ${delay / 1000} seconds...`, "polite");
    await new Promise((resolve) => setTimeout(resolve, delay));
    this.retryCount++;

    return { messages, options };
  }

  reset() {
    this.retryCount = 0;
  }
}
