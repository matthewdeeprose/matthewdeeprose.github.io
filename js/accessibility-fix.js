/**
 * @fileoverview Accessibility fix for tabindex on non-interactive elements
 *
 * This script removes tabindex attributes from <pre> elements within <dt> tags
 * in the developer panel, which improves accessibility by not adding non-interactive
 * elements to the keyboard tab order.
 */

document.addEventListener("DOMContentLoaded", function () {
  // Initial fix
  removeTabindexFromNonInteractiveElements();

  // Set up a MutationObserver to watch for changes to the DOM
  const observer = new MutationObserver(function (mutations) {
    removeTabindexFromNonInteractiveElements();
  });

  // Start observing the document with the configured parameters
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["tabindex"],
  });

  // Also run the fix when the debug panel is toggled
  const debugToggleButton = document.querySelector(".debug-toggle-button");
  if (debugToggleButton) {
    debugToggleButton.addEventListener("click", function () {
      // Use setTimeout to ensure the DOM has been updated
      setTimeout(removeTabindexFromNonInteractiveElements, 100);
    });
  }

  console.log(
    "[Accessibility Fix] Initialized tabindex removal for non-interactive elements"
  );
});

/**
 * Remove tabindex attributes from <pre> elements within <dt> tags
 * and other non-interactive contexts
 */
function removeTabindexFromNonInteractiveElements() {
  // Find all <pre> elements with tabindex
  const preElements = document.querySelectorAll(
    "pre[tabindex], pre code[tabindex]"
  );

  preElements.forEach((element) => {
    // Check if the element is within a <dt> or <dd> tag
    let parent = element;
    let isInNonInteractiveContext = false;

    while (parent && parent !== document.body) {
      const tagName = parent.tagName.toLowerCase();
      if (tagName === "dt" || tagName === "dd") {
        isInNonInteractiveContext = true;
        break;
      }
      parent = parent.parentElement;
    }

    // If in a non-interactive context, remove the tabindex
    if (isInNonInteractiveContext) {
      element.removeAttribute("tabindex");
      console.log(
        "[Accessibility Fix] Removed tabindex from non-interactive element:",
        element
      );

      // Also check for code elements inside pre
      if (element.tagName.toLowerCase() === "pre") {
        const codeElements = element.querySelectorAll("code[tabindex]");
        codeElements.forEach((codeElement) => {
          codeElement.removeAttribute("tabindex");
          console.log(
            "[Accessibility Fix] Removed tabindex from code element in non-interactive context:",
            codeElement
          );
        });
      }
    }
  });
}
