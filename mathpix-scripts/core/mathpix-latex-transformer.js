/**
 * MathPix LaTeX Delimiter Transformer
 *
 * Provides reliable conversion between LaTeX delimiter formats:
 * - \( ... \) ↔ $ ... $ (inline math)
 * - \[ ... \] ↔ $$ ... $$ (display math)
 *
 * WCAG 2.2 AA Compliant | British Spelling
 */

// Logging configuration
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
const ENABLE_ALL_LOGGING = false;
const DISABLE_ALL_LOGGING = false;

function shouldLog(level) {
  if (DISABLE_ALL_LOGGING) return false;
  if (ENABLE_ALL_LOGGING) return true;
  return level <= DEFAULT_LOG_LEVEL;
}

function logError(message, ...args) {
  if (shouldLog(LOG_LEVELS.ERROR))
    console.error("[LaTeX Transformer]", message, ...args);
}

function logWarn(message, ...args) {
  if (shouldLog(LOG_LEVELS.WARN))
    console.warn("[LaTeX Transformer]", message, ...args);
}

function logInfo(message, ...args) {
  if (shouldLog(LOG_LEVELS.INFO))
    console.log("[LaTeX Transformer]", message, ...args);
}

function logDebug(message, ...args) {
  if (shouldLog(LOG_LEVELS.DEBUG))
    console.log("[LaTeX Transformer]", message, ...args);
}

/**
 * LaTeX Delimiter Transformer Class
 */
class LaTeXTransformer {
  /**
   * Convert LaTeX from \( \) or \[ \] format to $ or $$ format
   * @param {string} latex - LaTeX string with \( \) or \[ \] delimiters
   * @returns {Object} - { inline: string, display: string, original: string }
   */
  static transformDelimiters(latex) {
    if (!latex || typeof latex !== "string") {
      logWarn("Invalid LaTeX input provided");
      return {
        original: latex || "",
        inline: latex || "",
        display: latex || "",
      };
    }

    logDebug("Transforming LaTeX delimiters", { inputLength: latex.length });

    // Store original
    const original = latex;

    // Convert \( ... \) to $ ... $ (inline math)
    // Match \( followed by any content (non-greedy), then \)
    const inlineConverted = latex.replace(
      /\\\((.*?)\\\)/gs,
      (match, content) => {
        logDebug("Converting inline math", { match, content });
        return `$${content}$`;
      }
    );

    // Convert \[ ... \] to $$ ... $$ (display math)
    const displayConverted = latex
      .replace(/\\\[(.*?)\\\]/gs, (match, content) => {
        logDebug("Converting display math", { match, content });
        return `$$${content}$$`;
      })
      // Also convert \( ... \) to $$ ... $$ for display version
      .replace(/\\\((.*?)\\\)/gs, (match, content) => {
        logDebug("Converting inline to display math", { match, content });
        return `$$${content}$$`;
      });

    const result = {
      original: original,
      inline: inlineConverted,
      display: displayConverted,
    };

    logInfo("LaTeX transformation complete", {
      hasInlineChanges: inlineConverted !== original,
      hasDisplayChanges: displayConverted !== original,
    });

    return result;
  }

  /**
   * Validate transformation by checking for common issues
   * @param {Object} transformed - Result from transformDelimiters
   * @returns {Object} - { valid: boolean, issues: string[] }
   */
  static validateTransformation(transformed) {
    const issues = [];

    // Check for unmatched delimiters in original
    const unmatchedOpen = (transformed.original.match(/\\\(/g) || []).length;
    const unmatchedClose = (transformed.original.match(/\\\)/g) || []).length;
    if (unmatchedOpen !== unmatchedClose) {
      issues.push(
        `Unmatched inline delimiters: ${unmatchedOpen} open, ${unmatchedClose} close`
      );
    }

    const unmatchedBracketOpen = (transformed.original.match(/\\\[/g) || [])
      .length;
    const unmatchedBracketClose = (transformed.original.match(/\\\]/g) || [])
      .length;
    if (unmatchedBracketOpen !== unmatchedBracketClose) {
      issues.push(
        `Unmatched display delimiters: ${unmatchedBracketOpen} open, ${unmatchedBracketClose} close`
      );
    }

    // Check for proper conversion in inline
    const inlineDollarCount = (
      transformed.inline.match(/(?<!\$)\$(?!\$)/g) || []
    ).length;
    if (inlineDollarCount % 2 !== 0) {
      issues.push(`Odd number of inline $ delimiters: ${inlineDollarCount}`);
    }

    // Check for proper conversion in display
    const displayDollarCount = (transformed.display.match(/\$\$/g) || [])
      .length;
    if (displayDollarCount % 2 !== 0) {
      issues.push(`Odd number of display $$ delimiters: ${displayDollarCount}`);
    }

    const valid = issues.length === 0;

    if (!valid) {
      logWarn("Transformation validation failed", { issues });
    } else {
      logInfo("Transformation validation passed");
    }

    return { valid, issues };
  }

  /**
   * Get delimiter format information
   * @param {string} latex - LaTeX string
   * @returns {Object} - Format information
   */
  static detectFormat(latex) {
    if (!latex || typeof latex !== "string") {
      return { format: "unknown", hasInline: false, hasDisplay: false };
    }

    const hasInlineBackslash = /\\\(.*?\\\)/.test(latex);
    const hasDisplayBackslash = /\\\[.*?\\\]/.test(latex);
    const hasInlineDollar = /(?<!\$)\$(?!\$).*?(?<!\$)\$(?!\$)/.test(latex);
    const hasDisplayDollar = /\$\$.*?\$\$/.test(latex);

    let format = "unknown";
    if (hasInlineBackslash || hasDisplayBackslash) {
      format = "backslash";
    } else if (hasInlineDollar || hasDisplayDollar) {
      format = "dollar";
    }

    return {
      format,
      hasInline: hasInlineBackslash || hasInlineDollar,
      hasDisplay: hasDisplayBackslash || hasDisplayDollar,
    };
  }

  /**
   * Transform with format preservation
   * Handles mixed inline \( \) and display \[ \] in same string
   */
  static transformWithFormatPreservation(latex) {
    if (!latex || typeof latex !== "string") {
      logWarn("Invalid LaTeX input provided");
      return {
        original: latex || "",
        dollarFormat: latex || "",
        doubleDollarFormat: latex || "",
      };
    }

    logDebug("Transforming with format preservation", {
      inputLength: latex.length,
    });

    const original = latex;

    // Dollar format: \( \) → $ $ and \[ \] → $$ $$
    // This preserves the distinction between inline and display math
    let dollarFormat = latex;
    dollarFormat = dollarFormat.replace(/\\\((.*?)\\\)/gs, (match, content) => {
      logDebug("Converting inline to $", { content: content.substring(0, 50) });
      return `$${content}$`;
    });
    dollarFormat = dollarFormat.replace(/\\\[(.*?)\\\]/gs, (match, content) => {
      logDebug("Converting display to $$", {
        content: content.substring(0, 50),
      });
      return `$$${content}$$`;
    });

    // Double dollar format: Everything → $$ $$
    // This forces all math to display mode
    let doubleDollarFormat = latex;
    doubleDollarFormat = doubleDollarFormat.replace(
      /\\\((.*?)\\\)/gs,
      (match, content) => {
        logDebug("Converting inline to $$ (forced display)", {
          content: content.substring(0, 50),
        });
        return `$$${content}$$`;
      }
    );
    doubleDollarFormat = doubleDollarFormat.replace(
      /\\\[(.*?)\\\]/gs,
      (match, content) => {
        logDebug("Converting display to $$ (already display)", {
          content: content.substring(0, 50),
        });
        return `$$${content}$$`;
      }
    );

    const result = {
      original: original,
      dollarFormat: dollarFormat,
      doubleDollarFormat: doubleDollarFormat,
    };

    logInfo("LaTeX transformation complete", {
      hasDollarChanges: dollarFormat !== original,
      hasDoubleDollarChanges: doubleDollarFormat !== original,
    });

    return result;
  }

  // Console testing function (inside the class as static method for module context)
  static runConsoleTests() {
    console.log("🧪 Testing LaTeX Transformer...\n");

    const tests = [
      {
        name: "Simple inline math",
        input: "\\( x^2 + y^2 = z^2 \\)",
        expectedDollar: "$ x^2 + y^2 = z^2 $",
        expectedDoubleDollar: "$$ x^2 + y^2 = z^2 $$",
      },
      {
        name: "Integration example (from user)",
        input: "\\( \\int 0^{1} x^{2} d x=1 / 3 \\)",
        expectedDollar: "$ \\int 0^{1} x^{2} d x=1 / 3 $",
        expectedDoubleDollar: "$$ \\int 0^{1} x^{2} d x=1 / 3 $$",
      },
      {
        name: "Display math",
        input: "\\[ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} \\]",
        expectedDollar: "$$ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} $$",
        expectedDoubleDollar: "$$ \\sum_{i=1}^{n} i = \\frac{n(n+1)}{2} $$",
      },
      {
        name: "Mixed inline and display (from user example)",
        input:
          "Base step: \\( n=1 \\)\n\\[\n\\begin{array}{l}\n\\sum_{k=1}^{n} 4 k^{3}=4 \\cdot 1^{3}=4\n\\end{array}\n\\]",
        expectedDollar:
          "Base step: $ n=1 $\n$$\n\\begin{array}{l}\n\\sum_{k=1}^{n} 4 k^{3}=4 \\cdot 1^{3}=4\n\\end{array}\n$$",
        expectedDoubleDollar:
          "Base step: $$ n=1 $$\n$$\n\\begin{array}{l}\n\\sum_{k=1}^{n} 4 k^{3}=4 \\cdot 1^{3}=4\n\\end{array}\n$$",
      },
      {
        name: "Complex induction proof excerpt",
        input:
          "Inductionstep: suppose that for\nsome \\( n \\): \\( \\sum^{n} 4 k^{3}=r^{2}(n+1)^{2} \\)\n\\[\n\\begin{aligned}\n\\sum_{k=1}^{n+1} 4 k^{3} & =n^{2}(n+1)^{2}+4(n+1)^{3}\n\\end{aligned}\n\\]",
        expectedDollar:
          "Inductionstep: suppose that for\nsome $ n $: $ \\sum^{n} 4 k^{3}=r^{2}(n+1)^{2} $\n$$\n\\begin{aligned}\n\\sum_{k=1}^{n+1} 4 k^{3} & =n^{2}(n+1)^{2}+4(n+1)^{3}\n\\end{aligned}\n$$",
        expectedDoubleDollar:
          "Inductionstep: suppose that for\nsome $$ n $$: $$ \\sum^{n} 4 k^{3}=r^{2}(n+1)^{2} $$\n$$\n\\begin{aligned}\n\\sum_{k=1}^{n+1} 4 k^{3} & =n^{2}(n+1)^{2}+4(n+1)^{3}\n\\end{aligned}\n$$",
      },
      {
        name: "Multiple inline expressions",
        input: "Consider \\( a^2 \\) and \\( b^2 \\) where \\( a + b = c \\)",
        expectedDollar: "Consider $ a^2 $ and $ b^2 $ where $ a + b = c $",
        expectedDoubleDollar:
          "Consider $$ a^2 $$ and $$ b^2 $$ where $$ a + b = c $$",
      },
    ];

    let passed = 0;
    let failed = 0;

    tests.forEach((test) => {
      console.log(`📝 Test: ${test.name}`);
      console.log(
        `   Input: ${test.input.substring(0, 80)}${
          test.input.length > 80 ? "..." : ""
        }`
      );

      const result = LaTeXTransformer.transformWithFormatPreservation(
        test.input
      );
      const validation = LaTeXTransformer.validateTransformation({
        original: result.original,
        inline: result.dollarFormat,
        display: result.doubleDollarFormat,
      });

      console.log(
        `   Dollar: ${result.dollarFormat.substring(0, 80)}${
          result.dollarFormat.length > 80 ? "..." : ""
        }`
      );
      console.log(
        `   Double: ${result.doubleDollarFormat.substring(0, 80)}${
          result.doubleDollarFormat.length > 80 ? "..." : ""
        }`
      );
      console.log(`   Valid: ${validation.valid}`);

      const dollarMatch = result.dollarFormat === test.expectedDollar;
      const doubleMatch =
        result.doubleDollarFormat === test.expectedDoubleDollar;

      if (dollarMatch && doubleMatch && validation.valid) {
        console.log("   ✅ PASSED\n");
        passed++;
      } else {
        console.log("   ❌ FAILED");
        if (!dollarMatch) {
          console.log(
            `      Expected dollar: ${test.expectedDollar.substring(0, 80)}...`
          );
          console.log(
            `      Got dollar:      ${result.dollarFormat.substring(0, 80)}...`
          );
        }
        if (!doubleMatch) {
          console.log(
            `      Expected double: ${test.expectedDoubleDollar.substring(
              0,
              80
            )}...`
          );
          console.log(
            `      Got double:      ${result.doubleDollarFormat.substring(
              0,
              80
            )}...`
          );
        }
        if (!validation.valid)
          console.log(`      Issues: ${validation.issues.join(", ")}`);
        console.log("");
        failed++;
      }
    });

    console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);
    return { passed, failed, total: tests.length };
  }
}

// Expose to window for console testing
if (typeof window !== "undefined") {
  window.LaTeXTransformer = LaTeXTransformer;
  window.testLaTeXTransformer = () => LaTeXTransformer.runConsoleTests();
}

// Export
export { LaTeXTransformer };
