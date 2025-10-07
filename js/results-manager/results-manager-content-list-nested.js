/**
 * @module NestedListProcessor
 * @description Processes nested lists
 */
import { ListProcessorBase } from "./results-manager-content-list-base.js";

export class NestedListProcessor extends ListProcessorBase {
  /**
   * Create a new NestedListProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Nested list processor initialized");
  }

  /**
   * Process nested lists in content
   * @param {string} content - Content to process
   * @returns {string} Content with nested lists converted to HTML
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing nested lists");

      // Split the text into blocks
      const blocks = content.split(/\n\n+/);

      // Process each block
      const processedBlocks = blocks.map((block) => {
        // Check if this block contains list items
        if (this.containsListItems(block)) {
          return this.processNestedListBlock(block);
        }
        return block;
      });

      return processedBlocks.join("\n\n");
    } catch (error) {
      this.utils.log("Error processing nested lists", { error }, "error");
      return content; // Return original content on error
    }
  }

  /**
   * Check if a block contains list items
   * @param {string} block - Block to check
   * @returns {boolean} True if block contains list items
   */
  containsListItems(block) {
    const lines = block.split("\n");
    return lines.some((line) => this.isListItem(line) !== null);
  }

  /**
   * Process a block containing nested lists
   * @param {string} block - Block with nested lists
   * @returns {string} HTML nested list
   */
  processNestedListBlock(block) {
    try {
      const lines = block.split("\n");

      // Create a tree structure to represent the list hierarchy
      const root = {
        level: -1,
        type: "root",
        items: [],
        children: [],
      };

      let currentNode = root;
      let stack = [root];

      // First pass: Build the tree structure
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const listInfo = this.isListItem(line);

        if (listInfo) {
          const currentLevel = listInfo.indent;

          // Navigate to the correct node in the tree
          if (currentLevel > currentNode.level) {
            // Going deeper - create a new child node
            const newNode = {
              level: currentLevel,
              type: listInfo.type,
              items: [],
              children: [],
              parent: currentNode,
            };

            currentNode.children.push(newNode);
            stack.push(newNode);
            currentNode = newNode;
          } else if (currentLevel < currentNode.level) {
            // Going back up - pop nodes from stack
            while (
              stack.length > 1 &&
              stack[stack.length - 1].level > currentLevel
            ) {
              stack.pop();
            }
            currentNode = stack[stack.length - 1];
          }

          // Add the item to the current node
          currentNode.items.push({
            type: listInfo.type,
            content: listInfo.content,
            number: listInfo.number,
            marker: listInfo.marker,
          });
        }
      }

      // Second pass: Convert the tree to HTML
      const html = this.renderListTree(root);
      return html;
    } catch (error) {
      this.utils.log("Error processing nested list block", { error }, "error");
      return block; // Return original content on error
    }
  }

  /**
   * Render a list tree to HTML
   * @param {Object} node - Tree node
   * @returns {string} HTML representation of the list
   */
  renderListTree(node) {
    if (node.type === "root") {
      // Root node - render children
      return node.children
        .map((child) => this.renderListTree(child))
        .join("\n");
    }

    // Create list tag based on type
    const listTag = node.type === "ordered" ? "ol" : "ul";
    let html = `<${listTag}>\n`;

    // Add list items
    node.items.forEach((item) => {
      const content = this.processInlineFormatting(item.content);
      html += `  <li>${content}`;

      // Add children if any
      if (node.children.length > 0) {
        const childrenHtml = node.children
          .map((child) => this.renderListTree(child))
          .join("\n");
        html += `\n${childrenHtml}`;
      }

      html += `</li>\n`;
    });

    html += `</${listTag}>`;
    return html;
  }
}
