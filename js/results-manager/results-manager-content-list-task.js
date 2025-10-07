/**
 * @module TaskListProcessor
 * @description Processes task lists with checkboxes that maintain formatting when copied and pasted
 */
import { ListProcessorBase } from "./results-manager-content-list-base.js";

export class TaskListProcessor extends ListProcessorBase {
  /**
   * Create a new TaskListProcessor instance
   */
  constructor() {
    super();
    this.utils.log("Task list processor initialized");
  }

  /**
   * Process task lists in content
   * @param {string} content - Content to process
   * @returns {string} Content with task lists converted to HTML
   */
  process(content) {
    if (!content) return "";

    try {
      this.utils.log("Processing task lists", {
        contentPreview: content.substring(0, 150),
        containsTaskList:
          content.includes("- [x]") || content.includes("- [ ]"),
        contentLength: content.length,
      });

      // Check if content contains task list markers
      if (!content.includes("- [") || !content.includes("]")) {
        this.utils.log("No task list markers found in content");
        return content;
      }

      // Find consecutive task list items and wrap them in <ul class="task-list">
      const lines = content.split("\n");
      let result = [];
      let inTaskList = false;
      let taskListItems = [];
      let taskListIndent = "";

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const taskMatch = line.match(/^(\s*)- \[([ x])\]\s+(.*)$/);

        if (taskMatch) {
          // This is a task list item
          const [_, indent, checked, text] = taskMatch;
          const isChecked = checked.toLowerCase() === "x";
          const icon = isChecked
            ? this.getCheckedTaskIcon()
            : this.getUncheckedTaskIcon();
          const status = isChecked ? "completed" : "incomplete";
          const processedText = this.processInlineFormatting(text);

          // Create task list item HTML with improved copy-paste structure
          const taskItem = `<li class="task-list-item" data-task-status="${status}">
  ${icon}<span class="task-list-item-text">${processedText}</span>
</li>`;

          if (!inTaskList) {
            // Start a new task list
            inTaskList = true;
            taskListIndent = indent;
            taskListItems = [taskItem];
          } else {
            // Add to existing task list
            taskListItems.push(taskItem);
          }
        } else {
          // Not a task list item
          if (inTaskList) {
            // End the current task list and add it to the result
            result.push(
              `${taskListIndent}<ul class="task-list" style="list-style-type: none; padding-left: 20px;">`
            );
            result = result.concat(
              taskListItems.map((item) => `  ${taskListIndent}${item}`)
            );
            result.push(`${taskListIndent}</ul>`);
            inTaskList = false;
          }

          // Add the current non-task-list line
          result.push(line);
        }
      }

      // If we're still in a task list at the end, close it
      if (inTaskList) {
        result.push(
          `${taskListIndent}<ul class="task-list" style="list-style-type: none; padding-left: 20px;">`
        );
        result = result.concat(
          taskListItems.map((item) => `  ${taskListIndent}${item}`)
        );
        result.push(`${taskListIndent}</ul>`);
      }

      const processed = result.join("\n");

      // Log the result after replacement
      this.utils.log("Task list content after processing", {
        processedSample: processed.substring(0, 300),
        originalLength: content.length,
        processedLength: processed.length,
        hasTaskList: processed.includes('<ul class="task-list">'),
      });

      return processed;
    } catch (error) {
      this.utils.log("Error processing task lists", { error }, "error");
      // Return the original content as fallback
      return content;
    }
  }

  /**
   * Get HTML for unchecked task
   * @returns {string} HTML markup with Unicode character
   */
  getUncheckedTaskIcon() {
    return `<span class="task-checkbox unchecked" aria-hidden="true" style="margin-right: 8px; font-size: 1.2em; line-height: 1; color: currentcolor;">☐</span>`;
  }

  /**
   * Get HTML for checked task
   * @returns {string} HTML markup with Unicode character
   */
  getCheckedTaskIcon() {
    return `<span class="task-checkbox checked" aria-hidden="true" style="margin-right: 8px; font-size: 1.2em; line-height: 1; color: currentcolor;">☑</span>`;
  }
}
