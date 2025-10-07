// js/modules/error-handler.js

import { a11y } from "../accessibility-helpers.js";

export class ErrorHandler {
  constructor() {
    this.fallbackStrategies = new Map();
    this.statusContainer = document.getElementById("statusAI");
    if (!this.statusContainer) {
      console.error("Status container with id 'statusAI' not found");
    }
    this.registerFallbackStrategies();
  }

  registerFallbackStrategies() {
    // Network errors
    this.fallbackStrategies.set("network", {
      check: (error) => error.name === "NetworkError" || !navigator.onLine,
      handle: async () => {
        const cached = await this.getCachedResponse();
        if (cached) {
          this.showMessage("Using cached response while offline", "warning");
          return cached;
        }
        this.showMessage(
          "Network error - Please check your connection",
          "error"
        );
        return null;
      },
    });

    // Rate limiting
    this.fallbackStrategies.set("rate_limit", {
      check: (error) => error.status === 429,
      handle: async (error, retryAfter) => {
        const waitTime = retryAfter || 5000;
        this.showMessage(
          `Rate limited. Retrying in ${waitTime / 1000} seconds...`,
          "warning"
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        return "retry";
      },
    });

    // Model unavailable
    this.fallbackStrategies.set("model_unavailable", {
      check: (error) =>
        error.status === 503 || error.message?.includes("model unavailable"),
      handle: async () => {
        this.showMessage(
          "Selected model unavailable. Switching to fallback model...",
          "warning"
        );
        return "switch_model";
      },
    });

    // Token quota exceeded
    this.fallbackStrategies.set("quota_exceeded", {
      check: (error) =>
        error.message?.includes("quota exceeded") || error.status === 402,
      handle: async () => {
        this.showMessage(
          "Token quota exceeded. Switching to free tier model...",
          "warning"
        );
        return "switch_free";
      },
    });

    // Timeout
    this.fallbackStrategies.set("timeout", {
      check: (error) =>
        error.message?.includes("timeout") || error.status === 408,
      handle: async () => {
        this.showMessage(
          "Request timed out. Retrying with reduced parameters...",
          "warning"
        );
        return "reduce_params";
      },
    });
  }

  async handleError(error, context = {}) {
    console.error("API Error:", error, "Context:", context);

    // Find matching fallback strategy
    for (const [key, strategy] of this.fallbackStrategies) {
      if (strategy.check(error)) {
        try {
          const result = await strategy.handle(error, context.retryAfter);
          return {
            action: result,
            error: error,
            strategy: key,
          };
        } catch (fallbackError) {
          console.error(`Fallback strategy ${key} failed:`, fallbackError);
        }
      }
    }

    // If no strategy matched or all failed, show generic error
    this.showMessage(this.getGenericErrorMessage(error), "error");
    return {
      action: "failed",
      error: error,
      strategy: null,
    };
  }

  // In error-handler.js, find the showMessage method
  showMessage(message, type = "error") {
    if (!this.statusContainer) return;

    const statusList = this.statusContainer.querySelector("#statusList");
    if (!statusList) {
      console.warn("Status list not found");
      return;
    }

    // Create new status item
    const li = document.createElement("li");
    li.className = `status-item ${type}`;

    // Create message text
    const messageSpan = document.createElement("span");
    messageSpan.className = "status-text";
    messageSpan.textContent = message;

    // Create timestamp
    const timeSpan = document.createElement("span");
    timeSpan.className = "status-time";
    timeSpan.textContent = new Date().toLocaleTimeString();

    // Assemble the item
    li.appendChild(messageSpan);
    li.appendChild(timeSpan);

    // Add to list
    statusList.appendChild(li);

    // Scroll to bottom
    const container = statusList.parentElement;
    container.scrollTop = container.scrollHeight;

    // Add keyboard scroll handling
    container.addEventListener("keydown", (e) => {
      const scrollAmount = 40; // Adjust this value as needed

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          container.scrollTop += scrollAmount;
          break;
        case "ArrowUp":
          e.preventDefault();
          container.scrollTop -= scrollAmount;
          break;
        case "PageDown":
          e.preventDefault();
          container.scrollTop += container.clientHeight;
          break;
        case "PageUp":
          e.preventDefault();
          container.scrollTop -= container.clientHeight;
          break;
        case "Home":
          e.preventDefault();
          container.scrollTop = 0;
          break;
        case "End":
          e.preventDefault();
          container.scrollTop = container.scrollHeight;
          break;
      }
    });
  }

  clearMessage() {
    // Do nothing - we're keeping all messages in the history
    return;
  }

  getGenericErrorMessage(error) {
    if (error.message?.includes("Authentication")) {
      return "Authentication failed. Please check your API key.";
    }
    if (error.status === 400) {
      return "Invalid request. Please check your input and try again.";
    }
    if (error.status === 500) {
      return "Server error occurred. Please try again later.";
    }
    return "An unexpected error occurred. Please try again.";
  }

  async getCachedResponse() {
    // Implement cache checking logic here
    return null;
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();
