/**
 * @module CodeContentProcessor
 * @description Processes code blocks with syntax highlighting and accessibility features
 */
import { ContentProcessorBase } from "./results-manager-content-base.js";
import { ContentProcessorUtils } from "./results-manager-content-utils.js";

export class CodeContentProcessor extends ContentProcessorBase {
  /**
   * Create a new CodeContentProcessor instance
   */
  constructor() {
    super();
    this.processorUtils = new ContentProcessorUtils();
    this.utils.log("Code content processor initialized");
  }

  /**
   * Process code blocks in content
   * @param {string} content - Content to process
   * @returns {string} Processed content with formatted code blocks
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing code blocks");
      let processed = content;

      // Store math blocks as placeholders to protect from other formatters
      const mathBlocks = [];
      processed = processed.replace(
        /```math\s*([\s\S]*?)```/g,
        (match, code) => {
          const placeholder = `__MATH_BLOCK_${mathBlocks.length}__`;
          mathBlocks.push(code.trim());
          return placeholder;
        }
      );

      // Convert code blocks with language specification
      processed = processed.replace(
        /```(\w+)?\s*([\s\S]*?)```/g,
        (match, lang, code) => {
          if (lang === "math") return match; // Skip math blocks we already processed
          return `<pre><code class="language-${
            lang || "text"
          }">${code.trim()}</code></pre>`;
        }
      );

      // Convert code blocks without language specification
      processed = processed.replace(
        /```\s*([\s\S]*?)```/g,
        "<pre><code>$1</code></pre>"
      );

      // Restore math blocks with proper formatting for MathJax
      mathBlocks.forEach((code, index) => {
        const placeholder = `__MATH_BLOCK_${index}__`;
        processed = processed.replace(
          placeholder,
          `<div class="math">$$${code}$$</div>`
        );
      });

      return processed;
    } catch (error) {
      this.utils.log("Error processing code blocks", { error }, "error");
      return content;
    }
  }
  /**
   * Enhance code blocks with syntax highlighting and accessibility features
   * @param {HTMLElement} container - Container with code blocks
   */
  enhanceCodeBlocks(container) {
    if (!container) {
      this.utils.log(
        "No container provided for enhancing code blocks",
        {},
        "warn"
      );
      return;
    }

    try {
      const codeBlocks = container.querySelectorAll("pre code");
      if (codeBlocks.length === 0) return;

      this.utils.log(`Enhancing ${codeBlocks.length} code blocks`);

      codeBlocks.forEach((block, index) => {
        // Get language from class
        const languageClass = Array.from(block.classList).find(
          (cls) => cls.startsWith("language-") || cls.startsWith("lang-")
        );

        let language = "text";
        if (languageClass) {
          language = languageClass.replace(/^(language-|lang-)/, "");
        } else {
          block.classList.add("language-text");
        }

        // Apply Prism highlighting if available
        if (window.Prism && block.textContent) {
          try {
            const originalCode = block.textContent;

            if (Prism.languages[language]) {
              block.innerHTML = Prism.highlight(
                originalCode,
                Prism.languages[language],
                language
              );
            } else if (Prism.languages.text) {
              block.innerHTML = Prism.highlight(
                originalCode,
                Prism.languages.text,
                "text"
              );
            }
          } catch (error) {
            this.utils.log(
              "Error applying syntax highlighting",
              { error },
              "error"
            );
          }
        }

        // Add accessibility enhancements
        this.enhanceCodeBlockAccessibility(block, language, index);

        // Prepare for copy button
        this.prepareForCopyButton(block, index);
      });
    } catch (error) {
      this.utils.log("Error enhancing code blocks", { error }, "error");
    }
  }

  /**
   * Enhance code block with accessibility features
   * @param {HTMLElement} block - Code block element
   * @param {string} language - Programming language
   * @param {number} index - Block index for identification
   */
  enhanceCodeBlockAccessibility(block, language, index) {
    try {
      // Check if the code block is within a <dt> element or other non-interactive context
      let isInNonInteractiveContext = false;
      let parent = block.parentElement;

      // Traverse up the DOM tree to check for non-interactive parent contexts
      while (parent) {
        const parentTag = parent.tagName.toLowerCase();
        if (parentTag === "dt" || parentTag === "dd") {
          isInNonInteractiveContext = true;
          this.utils.log("Code block found in non-interactive context", {
            context: parentTag,
          });
          break;
        }
        parent = parent.parentElement;
      }

      // Only add tabindex if not in a non-interactive context
      if (!isInNonInteractiveContext) {
        // Add tabindex for keyboard navigation
        block.setAttribute("tabindex", "0");
      } else {
        // Remove tabindex if it was previously set
        if (block.hasAttribute("tabindex")) {
          block.removeAttribute("tabindex");
        }
      }

      // Add aria-label with language information (always add this for screen readers)
      const languageDisplay = this.getLanguageDisplayName(language);
      block.setAttribute("aria-label", `Code example in ${languageDisplay}`);

      if (!block.id) {
        block.id = `code-block-${index}-${Date.now()}`;
      }
    } catch (error) {
      this.utils.log(
        "Error enhancing code block accessibility",
        { error },
        "error"
      );
    }
  }

  /**
   * Get user-friendly display name for a language
   * @param {string} languageCode - Language code/alias
   * @returns {string} Display name for the language
   */
  getLanguageDisplayName(languageCode) {
    const languageMap = {
      js: "JavaScript",
      ts: "TypeScript",
      py: "Python",
      rb: "Ruby",
      cs: "C#",
      cpp: "C++",
      php: "PHP",
      java: "Java",
      go: "Go",
      rust: "Rust",
      html: "HTML",
      css: "CSS",
      scss: "SCSS",
      sql: "SQL",
      sh: "Shell",
      bash: "Bash",
      powershell: "PowerShell",
      yaml: "YAML",
      json: "JSON",
      md: "Markdown",
      text: "Plain text",
    };

    return languageMap[languageCode] || languageCode;
  }

  /**
   * Prepare code block for copy button implementation
   * @param {HTMLElement} block - Code block element
   * @param {number} index - Block index for identification
   */
  prepareForCopyButton(block, index) {
    try {
      const preElement = block.parentElement;
      if (!preElement || preElement.tagName !== "PRE") return;

      preElement.classList.add("code-block-container");
      preElement.dataset.originalCode = block.textContent;

      if (!preElement.id) {
        preElement.id = `pre-block-${index}-${Date.now()}`;
      }

      this.addCopyButton(block, preElement, index);
    } catch (error) {
      this.utils.log("Error preparing for copy button", { error }, "error");
    }
  }

  /**
   * Add copy button to code block
   * @param {HTMLElement} block - Code block element
   * @param {HTMLElement} preElement - Parent pre element
   * @param {number} index - Block index for identification
   */
  addCopyButton(block, preElement, index) {
    try {
      const copyButton = document.createElement("button");
      copyButton.className = "code-copy-button";
      copyButton.innerHTML = `${this.processorUtils.getCopyButtonIcon()} Copy`;
      copyButton.setAttribute("aria-label", "Copy code to clipboard");
      copyButton.setAttribute("type", "button");

      copyButton.addEventListener("click", () => {
        this.copyCodeToClipboard(preElement, copyButton);
      });

      preElement.appendChild(copyButton);
    } catch (error) {
      this.utils.log("Error adding copy button", { error }, "error");
    }
  }

  /**
   * Copy code to clipboard
   * @param {HTMLElement} preElement - Pre element containing code
   * @param {HTMLElement} button - Copy button element
   */
  copyCodeToClipboard(preElement, button) {
    try {
      const code = preElement.dataset.originalCode;
      if (!code) return;

      // Use Clipboard API if available
      if (navigator.clipboard) {
        navigator.clipboard
          .writeText(code)
          .then(() => {
            const originalContent = button.innerHTML;
            button.innerHTML = `${this.processorUtils.getCopyButtonIcon()} Copied`;

            this.announceToScreenReader("Code snippet copied to clipboard");

            setTimeout(() => {
              button.innerHTML = originalContent;
            }, 2000);
          })
          .catch((error) => {
            this.utils.log("Error copying to clipboard", { error }, "error");
            this.fallbackCopyToClipboard(code, button);
          });
      } else {
        this.fallbackCopyToClipboard(code, button);
      }
    } catch (error) {
      this.utils.log("Error in copy to clipboard function", { error }, "error");
    }
  }

  /**
   * Fallback method for copying to clipboard
   * @param {string} text - Text to copy
   * @param {HTMLElement} button - Copy button element
   */
  fallbackCopyToClipboard(text, button) {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-999999px";
      textarea.style.top = "-999999px";

      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();

      const successful = document.execCommand("copy");
      document.body.removeChild(textarea);

      if (successful) {
        const originalContent = button.innerHTML;
        button.innerHTML = `${this.processorUtils.getCopyButtonIcon()} Copied`;

        this.announceToScreenReader("Code snippet copied to clipboard");

        setTimeout(() => {
          button.innerHTML = originalContent;
        }, 2000);
      }
    } catch (error) {
      this.utils.log("Error in fallback copy to clipboard", { error }, "error");
    }
  }

  /**
   * Announce message to screen readers
   * @param {string} message - Message to announce
   */
  announceToScreenReader(message) {
    try {
      let announcer = document.getElementById("sr-announcer");

      if (!announcer) {
        announcer = document.createElement("div");
        announcer.id = "sr-announcer";
        announcer.className = "sr-only";
        announcer.setAttribute("aria-live", "polite");
        announcer.setAttribute("aria-atomic", "true");
        document.body.appendChild(announcer);

        if (!document.getElementById("sr-styles")) {
          const style = document.createElement("style");
          style.id = "sr-styles";
          style.textContent = `
            .sr-only {
              position: absolute;
              width: 1px;
              height: 1px;
              padding: 0;
              margin: -1px;
              overflow: hidden;
              clip: rect(0, 0, 0, 0);
              white-space: nowrap;
              border: 0;
            }
          `;
          document.head.appendChild(style);
        }
      }

      announcer.textContent = message;
    } catch (error) {
      this.utils.log("Error announcing to screen readers", { error }, "error");
    }
  }
}
