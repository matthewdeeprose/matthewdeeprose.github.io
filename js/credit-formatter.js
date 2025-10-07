// js/credit-formatter.js

/**
 * Formats remaining credits with proper currency symbol, decimal places, and percentage
 * @param {number} currentUsage - Current credit usage amount
 * @param {number|null} creditLimit - Credit limit (null for unlimited)
 * @param {Object} [options] - Formatting options
 * @param {string} [options.locale='en-US'] - Locale for number formatting
 * @param {string} [options.currency='USD'] - Currency code
 * @returns {Object} Formatted credit information with accessibility properties
 * @throws {Error} If currentUsage is not a valid number
 */
export function formatRemainingCredits(
  currentUsage,
  creditLimit,
  options = {}
) {
  // Validate inputs
  if (typeof currentUsage !== "number" || isNaN(currentUsage)) {
    throw new Error("Current usage must be a valid number");
  }

  const locale = options.locale || "en-US";
  const currency = options.currency || "USD";

  // Handle unlimited credits case
  if (creditLimit === null) {
    return {
      displayText: "Unlimited credits available",
      ariaLabel: "Unlimited credits available",
      remainingAmount: Infinity,
      percentage: 100,
      isUnlimited: true,
    };
  }

  // Validate credit limit
  if (
    typeof creditLimit !== "number" ||
    isNaN(creditLimit) ||
    creditLimit < 0
  ) {
    throw new Error("Credit limit must be a valid positive number");
  }

  // Calculate remaining amount (never negative)
  const remainingAmount = Math.max(0, creditLimit - currentUsage);

  // Calculate percentage with bounds checking
  const percentage =
    creditLimit === 0
      ? 0
      : Math.max(0, Math.min(100, (remainingAmount / creditLimit) * 100));

  // Format the currency amount using Intl.NumberFormat
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 10,
    // Use standard notation for regular numbers, scientific for very large ones
    notation: remainingAmount > 999999 ? "scientific" : "standard",
  });

  // Format percentage with 1 decimal place
  const percentFormatter = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const formattedAmount = currencyFormatter.format(remainingAmount);
  const formattedPercentage = percentFormatter.format(percentage);

  // Construct display text
  const displayText = `${formattedAmount} remaining (${formattedPercentage}% available)`;

  // Construct more detailed ARIA label
  const ariaLabel = `${formattedAmount} credits remaining, ${formattedPercentage} percent of total credit limit available`;

  return {
    displayText,
    ariaLabel,
    remainingAmount,
    percentage,
    isUnlimited: false,
    raw: {
      amount: remainingAmount,
      percentage: percentage,
    },
  };
}

/**
 * Validates and sanitizes a currency symbol for safe display
 * @param {string} symbol - Currency symbol to sanitize
 * @returns {string} Sanitized currency symbol
 * @private
 */
function sanitizeCurrencySymbol(symbol) {
  // Remove any potential HTML/script injection
  return symbol.replace(/[<>&]/g, "").trim();
}

// Export additional utilities that might be useful for the credit system
export const CreditFormatter = {
  /**
   * Formats a number for accounting display (parentheses for negative)
   * @param {number} amount - Amount to format
   * @param {string} [locale='en-US'] - Locale for formatting
   * @returns {string} Formatted amount
   */
  formatAccountingStyle(amount, locale = "en-US") {
    const formatter = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
      currencySign: "accounting",
    });
    return formatter.format(amount);
  },

  /**
   * Checks if a credit amount should trigger a warning
   * @param {number} remainingCredits - Remaining credits
   * @param {number} threshold - Warning threshold percentage
   * @returns {boolean} True if warning should be shown
   */
  shouldShowWarning(remainingCredits, threshold) {
    return remainingCredits <= threshold;
  },
};
