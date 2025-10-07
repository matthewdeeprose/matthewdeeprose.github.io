/**
 * Complete Universal Modal Testing Suite
 * Combines basic functionality tests with comprehensive accessibility testing
 * Includes WCAG 2.2 AA compliance testing and responsive design validation
 *
 * @version 2.0.1 - Fixed global scope conflicts
 * @requires UniversalModal, UniversalNotifications (optional)
 */

const UniversalModalTests = (function () {
  "use strict";

  // ====== Logging Configuration ======
  const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3,
  };

  const DEFAULT_LOG_LEVEL = LOG_LEVELS.INFO;
  const ENABLE_ALL_LOGGING = false;
  const DISABLE_ALL_LOGGING = false;

  function shouldLog(level) {
    if (DISABLE_ALL_LOGGING) return false;
    if (ENABLE_ALL_LOGGING) return true;
    return level <= DEFAULT_LOG_LEVEL;
  }

  function logError(message, ...args) {
    if (shouldLog(LOG_LEVELS.ERROR))
      console.error(`[Modal Tests ERROR]: ${message}`, ...args);
  }

  function logWarn(message, ...args) {
    if (shouldLog(LOG_LEVELS.WARN))
      console.warn(`[Modal Tests WARN]: ${message}`, ...args);
  }

  function logInfo(message, ...args) {
    if (shouldLog(LOG_LEVELS.INFO))
      console.log(`[Modal Tests INFO]: ${message}`, ...args);
  }

  function logDebug(message, ...args) {
    if (shouldLog(LOG_LEVELS.DEBUG))
      console.log(`[Modal Tests DEBUG]: ${message}`, ...args);
  }

  // ====== BASIC FUNCTIONALITY TESTS ======

  // Test basic alert functionality
  function testModalAlert() {
    UniversalModal.alert("This is a test alert message!", "Test Alert").then(
      () => {
        logInfo("Alert was dismissed");
        if (window.UniversalNotifications) {
          UniversalNotifications.success("Alert test completed");
        }
      }
    );
  }

  // Test confirmation functionality
  function testModalConfirm() {
    UniversalModal.confirm(
      "Do you want to proceed with this test?",
      "Test Confirmation"
    ).then((result) => {
      logInfo("User chose:", result);
      const message = result ? "User confirmed" : "User cancelled";
      if (window.UniversalNotifications) {
        UniversalNotifications.info(message);
      }
    });
  }

  // Test custom modal
  function testCustomModal() {
    const modal = UniversalModal.create({
      title: "Custom Test Modal",
      content: `
        <div style="text-align: center;">
          <p>This is a custom modal with custom content.</p>
          <button id="custom-modal-btn" class="universal-confirm-yes">Click Me!</button>
        </div>
      `,
      size: "medium",
      onOpen: function (modalInstance) {
        const button = modalInstance.modal.querySelector("#custom-modal-btn");
        button.addEventListener("click", function () {
          if (window.UniversalNotifications) {
            UniversalNotifications.success("Custom button clicked!");
          }
          modalInstance.close();
        });
      },
      onClose: function () {
        logInfo("Custom modal closed");
      },
    });

    modal.open();
  }

  // Test error handling
  function testModalErrorHandling() {
    // Test with invalid options to see error handling
    try {
      const modal = UniversalModal.create({
        title: null, // This might cause issues
        content: undefined,
      });
      modal.open();
    } catch (error) {
      logError("Expected error:", error);
      if (window.UniversalNotifications) {
        UniversalNotifications.warning("Error handling test completed");
      }
    }
  }

  // Test all modal sizes
  function testModalSizes() {
    const sizes = ["small", "medium", "large", "full"];
    let currentIndex = 0;

    function showNextModal() {
      if (currentIndex >= sizes.length) {
        if (window.UniversalNotifications) {
          UniversalNotifications.success("All modal sizes tested!");
        }
        return;
      }

      const size = sizes[currentIndex];
      UniversalModal.alert(
        `This is a ${size} modal. Click OK to see the next size.`,
        `${size.charAt(0).toUpperCase() + size.slice(1)} Modal Test`,
        { size: size }
      ).then(() => {
        currentIndex++;
        setTimeout(showNextModal, 500);
      });
    }

    showNextModal();
  }

  // ====== USAGE EXAMPLES ======

  // Example: Error confirmation
  function exampleErrorConfirm() {
    return new Promise(async function (resolve) {
      try {
        const confirmed = await UniversalModal.confirm(
          "An error occurred while processing your request. Would you like to retry?",
          "Error Occurred",
          {
            confirmText: "Retry",
            cancelText: "Cancel",
            className: "error",
            size: "medium",
          }
        );

        if (confirmed) {
          logInfo("User chose to retry");
          // Retry logic here
        } else {
          logInfo("User cancelled");
        }
        resolve(confirmed);
      } catch (error) {
        logError("Modal failed:", error);
        resolve(false);
      }
    });
  }

  // Example: Success notification
  function exampleSuccessAlert() {
    return UniversalModal.alert(
      "Your data has been successfully saved!",
      "Success",
      {
        className: "success",
        size: "small",
      }
    );
  }

  // Example: Loading modal
  function exampleLoadingModal() {
    const modal = UniversalModal.create({
      title: "Processing...",
      content: "<p>Please wait while we process your request.</p>",
      size: "small",
      className: "loading",
      closeOnOverlayClick: false,
      closeOnEscape: false,
    });

    modal.open();

    // Simulate processing time
    setTimeout(() => {
      modal.setContent("<p>Processing complete!</p>");
      modal.setTitle("Complete");
      modal.modal.classList.remove("loading");
      modal.modal.classList.add("success");

      // Auto-close after showing success
      setTimeout(() => {
        modal.close();
        modal.destroy();
      }, 2000);
    }, 3000);
  }

  // ====== INTEGRATION HELPER FUNCTIONS ======

  /**
   * Safe modal confirm - automatically falls back to native confirm
   * @param {string} message - Confirmation message
   * @param {string} title - Modal title (optional)
   * @param {Object} options - Modal options (optional)
   * @returns {Promise<boolean>} User's choice
   */
  function safeConfirm(message, title = "Confirm", options = {}) {
    return new Promise(async function (resolve) {
      try {
        if (window.UniversalModal) {
          const result = await UniversalModal.confirm(message, title, options);
          resolve(result);
        } else {
          logWarn("UniversalModal not available, using native confirm");
          resolve(confirm(message));
        }
      } catch (error) {
        logError("Modal confirm failed, falling back to native:", error);
        resolve(confirm(message));
      }
    });
  }

  /**
   * Safe modal alert - automatically falls back to native alert
   * @param {string} message - Alert message
   * @param {string} title - Modal title (optional)
   * @param {Object} options - Modal options (optional)
   * @returns {Promise<void>}
   */
  function safeAlert(message, title = "Alert", options = {}) {
    return new Promise(async function (resolve) {
      try {
        if (window.UniversalModal) {
          await UniversalModal.alert(message, title, options);
          resolve();
        } else {
          logWarn("UniversalModal not available, using native alert");
          alert(message);
          resolve();
        }
      } catch (error) {
        logError("Modal alert failed, falling back to native:", error);
        alert(message);
        resolve();
      }
    });
  }

  /**
   * Replace all native confirms in a function with modal confirms
   * @param {Function} originalFunction - Function that uses confirm()
   * @returns {Function} Wrapped function that uses modal confirms
   */
  function wrapWithModalConfirm(originalFunction) {
    return async function (...args) {
      // Temporarily replace global confirm
      const originalConfirm = window.confirm;
      window.confirm = function (message) {
        return safeConfirm(message);
      };

      try {
        const result = await originalFunction.apply(this, args);
        return result;
      } finally {
        // Restore original confirm
        window.confirm = originalConfirm;
      }
    };
  }

  // ====== ACCESSIBILITY TESTS - Content Length Testing ======

  /**
   * Test modal with very long content to check scrolling behaviour
   */
  function testLongContent() {
    const longContent = `
      <h3>Very Long Content Test</h3>
      <p>This modal contains extensive content to test scrolling behaviour, content overflow handling, and accessibility with long-form content.</p>
      
      <h4>Section 1: Lorem Ipsum</h4>
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.</p>
      
      <h4>Section 2: Lists and Structure</h4>
      <ul>
        <li>First item with detailed explanation about modal content handling</li>
        <li>Second item discussing accessibility considerations for long content</li>
        <li>Third item covering responsive design aspects</li>
        <li>Fourth item about keyboard navigation in scrollable content</li>
        <li>Fifth item regarding screen reader compatibility</li>
      </ul>
      
      <h4>Section 3: Interactive Elements</h4>
      <p>Testing focus management with multiple interactive elements:</p>
      <button type="button" class="modal-action-button">Test Button 1</button>
      <button type="button" class="modal-action-button">Test Button 2</button>
      <button type="button" class="modal-action-button">Test Button 3</button>
      
      <h4>Section 4: Form Elements</h4>
      <form>
        <div style="margin: 1rem 0;">
          <label for="test-input-1">Test Input Field:</label>
          <input type="text" id="test-input-1" name="testInput1" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem;">
        </div>
        <div style="margin: 1rem 0;">
          <label for="test-select-1">Test Select Field:</label>
          <select id="test-select-1" name="testSelect1" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem;">
            <option value="option1">Option 1</option>
            <option value="option2">Option 2</option>
            <option value="option3">Option 3</option>
          </select>
        </div>
        <div style="margin: 1rem 0;">
          <label for="test-textarea-1">Test Textarea:</label>
          <textarea id="test-textarea-1" name="testTextarea1" rows="4" style="width: 100%; padding: 0.5rem; margin-top: 0.25rem;">Test content for textarea element</textarea>
        </div>
      </form>
      
      <h4>Section 5: More Content</h4>
      <p>Additional paragraphs to ensure we have enough content to test scrolling behaviour thoroughly. This content should cause the modal to display a vertical scrollbar when the viewport height is insufficient.</p>
      
      <p>Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium.</p>
      
      <h4>Section 6: Final Test Content</h4>
      <p>This is the final section to ensure we have sufficient content for thorough testing of scroll behaviour, focus management within scrollable content, and overall modal accessibility.</p>
      
      <div style="text-align: center; margin: 2rem 0;">
        <button type="button" class="modal-action-button primary">Primary Action</button>
        <button type="button" class="modal-action-button">Secondary Action</button>
      </div>
    `;

    const modal = UniversalModal.create({
      title: "Long Content Accessibility Test",
      content: longContent,
      size: "large",
      className: "long-content-test",
      onOpen: function (modalInstance) {
        logInfo(
          "Long content modal opened - test keyboard navigation and scrolling"
        );

        // Add click handlers for test buttons
        const buttons = modalInstance.modal.querySelectorAll(
          ".modal-action-button"
        );
        buttons.forEach((button, index) => {
          button.addEventListener("click", function () {
            logInfo(`Test button ${index + 1} clicked`);
            if (window.UniversalNotifications) {
              UniversalNotifications.info(`Button ${index + 1} activated`);
            }
          });
        });
      },
    });

    modal.open();
  }

  /**
   * Test modal with extremely long single paragraph
   */
  function testVeryLongText() {
    const veryLongText =
      "This is an extremely long paragraph designed to test how the modal handles very lengthy text content without proper line breaks. ".repeat(
        50
      ) +
      "This content tests text wrapping, reading flow, and ensures that screen readers can navigate through extensive text content effectively. The modal should maintain proper focus management and scrolling behaviour even with this much continuous text content.";

    UniversalModal.alert(veryLongText, "Very Long Text Test", {
      size: "medium",
      className: "very-long-text-test",
    });
  }

  /**
   * Test modal with mixed content types
   */
  function testMixedContent() {
    const mixedContent = `
      <div class="mixed-content-test">
        <img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iIzAwNWM4NCIvPjx0ZXh0IHg9IjUwIiB5PSI1NSIgZm9udC1mYW1pbHk9InNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5UZXN0IEltYWdlPC90ZXh0Pjwvc3ZnPg==" alt="Test image for accessibility testing" style="max-width: 100%; height: auto; margin: 1rem 0;">
        
        <h3>Mixed Content Test</h3>
        <p>This modal contains various content types to test accessibility across different elements.</p>
        
        <blockquote style="border-left: 4px solid #005c84; padding-left: 1rem; margin: 1rem 0; font-style: italic;">
          "This is a blockquote to test how screen readers handle quoted content within modals."
        </blockquote>
        
        <table style="width: 100%; border-collapse: collapse; margin: 1rem 0;">
          <caption>Test Data Table</caption>
          <thead>
            <tr>
              <th style="border: 1px solid #ccc; padding: 0.5rem; text-align: left;">Header 1</th>
              <th style="border: 1px solid #ccc; padding: 0.5rem; text-align: left;">Header 2</th>
              <th style="border: 1px solid #ccc; padding: 0.5rem; text-align: left;">Header 3</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 1</td>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 2</td>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 3</td>
            </tr>
            <tr>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 4</td>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 5</td>
              <td style="border: 1px solid #ccc; padding: 0.5rem;">Data 6</td>
            </tr>
          </tbody>
        </table>
        
        <details style="margin: 1rem 0;">
          <summary>Expandable Content Section</summary>
          <p>This is content within a details element to test interactive disclosure patterns.</p>
        </details>
        
        <a href="#test-link" onclick="event.preventDefault(); alert('Test link clicked');">Test Link</a>
      </div>
    `;

    UniversalModal.create({
      title: "Mixed Content Accessibility Test",
      content: mixedContent,
      size: "large",
      className: "mixed-content-test",
    }).open();
  }

  // ====== ACCESSIBILITY TESTS - Viewport Testing ======

  /**
   * Test modal responsiveness at different viewport sizes
   */
  function testViewportSizes() {
    const viewports = [
      { name: "Mobile Portrait", width: 375, height: 667 },
      { name: "Mobile Landscape", width: 667, height: 375 },
      { name: "Tablet Portrait", width: 768, height: 1024 },
      { name: "Tablet Landscape", width: 1024, height: 768 },
      { name: "Desktop", width: 1200, height: 800 },
      { name: "Large Desktop", width: 1920, height: 1080 },
    ];

    let currentIndex = 0;

    function testNextViewport() {
      if (currentIndex >= viewports.length) {
        logInfo("Viewport testing completed");
        if (window.UniversalNotifications) {
          UniversalNotifications.success(
            "Viewport testing completed! Check console for results."
          );
        }
        return;
      }

      const viewport = viewports[currentIndex];

      // Temporarily resize viewport (note: this only works in responsive design mode)
      logInfo(
        `Testing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`
      );

      UniversalModal.alert(
        `Testing modal responsiveness at ${viewport.name} viewport (${viewport.width}x${viewport.height}px). Check modal positioning, sizing, and content accessibility.`,
        `Viewport Test: ${viewport.name}`,
        {
          size: "medium",
          className: `viewport-test viewport-${viewport.name
            .toLowerCase()
            .replace(" ", "-")}`,
        }
      ).then(() => {
        currentIndex++;
        setTimeout(testNextViewport, 1000);
      });
    }

    testNextViewport();
  }

  /**
   * Test modal at very small viewport
   */
  function testSmallViewport() {
    logInfo(
      "Testing modal at very small viewport - check mobile accessibility"
    );

    UniversalModal.create({
      title: "Small Viewport Test",
      content: `
        <p>This modal tests behaviour on very small screens (below 480px width).</p>
        <div style="margin: 1rem 0;">
          <button type="button" class="modal-action-button">Test Button 1</button>
          <button type="button" class="modal-action-button">Test Button 2</button>
        </div>
        <p>Check that:</p>
        <ul>
          <li>Modal fits within viewport</li>
          <li>Content is readable</li>
          <li>Buttons are touch-friendly (min 44x44px)</li>
          <li>Text doesn't overflow</li>
          <li>Close button is accessible</li>
        </ul>
      `,
      size: "small",
      className: "small-viewport-test",
    }).open();
  }

  // ====== ACCESSIBILITY TESTS - Focus and Keyboard Navigation ======

  /**
   * Test focus management and keyboard navigation
   */
  function testFocusManagement() {
    const focusTestContent = `
      <div class="focus-test-content">
        <p>Test keyboard navigation with Tab, Shift+Tab, and Enter keys:</p>
        <button type="button" id="focus-test-btn-1" class="modal-action-button">Button 1</button>
        <input type="text" id="focus-test-input" placeholder="Test input field" style="margin: 0.5rem; padding: 0.5rem;">
        <select id="focus-test-select" style="margin: 0.5rem; padding: 0.5rem;">
          <option>Option 1</option>
          <option>Option 2</option>
        </select>
        <textarea id="focus-test-textarea" placeholder="Test textarea" style="margin: 0.5rem; padding: 0.5rem; width: 100%; height: 60px;"></textarea>
        <a href="#" id="focus-test-link" onclick="event.preventDefault(); logInfo('Test link activated');">Test Link</a>
        <button type="button" id="focus-test-btn-2" class="modal-action-button">Button 2</button>
        
        <div style="margin-top: 1rem;">
          <h4>Focus Testing Instructions:</h4>
          <ol>
            <li>Press Tab to move forward through elements</li>
            <li>Press Shift+Tab to move backward</li>
            <li>Press Escape to close modal</li>
            <li>Verify focus indicators are visible for keyboard users</li>
            <li>Check that focus doesn't escape the modal</li>
          </ol>
        </div>
      </div>
    `;

    const modal = UniversalModal.create({
      title: "Focus Management Test",
      content: focusTestContent,
      size: "medium",
      className: "focus-management-test",
      onOpen: function (modalInstance) {
        logInfo("Focus management test started - use keyboard navigation");

        // Test focus indicators
        const focusableElements = modalInstance.modal.querySelectorAll(
          "button, input, select, textarea, a"
        );
        focusableElements.forEach((element, index) => {
          element.addEventListener("focus", function () {
            logDebug(
              `Focus on element ${index + 1}: ${element.tagName} ${
                element.id || element.className
              }`
            );
          });

          element.addEventListener("blur", function () {
            logDebug(
              `Blur from element ${index + 1}: ${element.tagName} ${
                element.id || element.className
              }`
            );
          });
        });
      },
    });

    modal.open();
  }

  /**
   * Test ARIA attributes and screen reader announcements
   */
  function testARIAAttributes() {
    logInfo("Testing ARIA attributes - check with screen reader");

    const ariaTestContent = `
      <div role="region" aria-labelledby="aria-test-heading">
        <h3 id="aria-test-heading">ARIA Attributes Test</h3>
        <p>This test verifies proper ARIA implementation:</p>
        
        <div aria-live="polite" id="aria-live-region" style="border: 1px solid #ccc; padding: 1rem; margin: 1rem 0;">
          <p>Live region for testing announcements</p>
        </div>
        
        <button type="button" id="aria-test-announce" class="modal-action-button" 
                aria-describedby="aria-announce-desc">
          Trigger Announcement
        </button>
        <div id="aria-announce-desc" class="sr-only">
          This button will update the live region above
        </div>
        
        <fieldset style="margin: 1rem 0; padding: 1rem; border: 1px solid #ccc;">
          <legend>Test Form Group</legend>
          <div>
            <input type="radio" id="radio1" name="test-radio" aria-describedby="radio-desc">
            <label for="radio1">Option 1</label>
          </div>
          <div>
            <input type="radio" id="radio2" name="test-radio" aria-describedby="radio-desc">
            <label for="radio2">Option 2</label>
          </div>
          <div id="radio-desc" class="sr-only">Choose one option for testing</div>
        </fieldset>
        
        <button type="button" class="modal-action-button" aria-expanded="false" 
                aria-controls="expandable-content" id="aria-expand-btn">
          Toggle Expandable Content
        </button>
        <div id="expandable-content" style="display: none; margin: 1rem 0; padding: 1rem; background: #f5f5f5;">
          <p>This content can be shown/hidden for testing aria-expanded</p>
        </div>
      </div>
    `;

    const modal = UniversalModal.create({
      title: "ARIA Attributes Test",
      content: ariaTestContent,
      size: "medium",
      className: "aria-attributes-test",
      onOpen: function (modalInstance) {
        let announceCount = 0;

        // Set up announcement test
        const announceBtn = modalInstance.modal.querySelector(
          "#aria-test-announce"
        );
        const liveRegion =
          modalInstance.modal.querySelector("#aria-live-region");

        announceBtn.addEventListener("click", function () {
          announceCount++;
          liveRegion.innerHTML = `<p>Announcement ${announceCount}: Live region updated at ${new Date().toLocaleTimeString()}</p>`;
          logInfo(`Live region announcement ${announceCount} triggered`);
        });

        // Set up expandable content test
        const expandBtn = modalInstance.modal.querySelector("#aria-expand-btn");
        const expandableContent = modalInstance.modal.querySelector(
          "#expandable-content"
        );

        expandBtn.addEventListener("click", function () {
          const isExpanded = expandBtn.getAttribute("aria-expanded") === "true";
          expandBtn.setAttribute("aria-expanded", !isExpanded);
          expandableContent.style.display = isExpanded ? "none" : "block";
          expandBtn.textContent = isExpanded
            ? "Show Expandable Content"
            : "Hide Expandable Content";
          logInfo(
            `Expandable content ${isExpanded ? "collapsed" : "expanded"}`
          );
        });

        logInfo(
          "ARIA test ready - use screen reader to test announcements and relationships"
        );
      },
    });

    modal.open();
  }

  // ====== ACCESSIBILITY TESTS - Visual and Motion ======

  /**
   * Test colour contrast and high contrast mode
   */
  function testColourContrast() {
    const contrastTestContent = `
      <div class="contrast-test-content">
        <h3>Colour Contrast Test</h3>
        <p>This test helps verify colour contrast ratios meet WCAG 2.2 AA requirements (4.5:1 for normal text, 3:1 for large text).</p>
        
        <div style="background: #fffff4; color: #231f20; padding: 1rem; margin: 1rem 0; border: 1px solid #002e3b;">
          <p><strong>Normal text on light background</strong></p>
          <p>This text should have sufficient contrast for reading. Check with a contrast analyser tool.</p>
        </div>
        
        <div style="background: #005c84; color: #fffff4; padding: 1rem; margin: 1rem 0;">
          <p><strong>Light text on dark background</strong></p>
          <p>This text should also meet contrast requirements.</p>
        </div>
        
        <div style="margin: 1rem 0;">
          <button type="button" class="modal-action-button primary">Primary Button (Check contrast)</button>
          <button type="button" class="modal-action-button">Secondary Button (Check contrast)</button>
          <button type="button" class="modal-action-button danger">Danger Button (Check contrast)</button>
        </div>
        
        <p><strong>Testing Instructions:</strong></p>
        <ul>
          <li>Use browser dev tools or contrast analyser to check ratios</li>
          <li>Test in Windows High Contrast mode</li>
          <li>Verify focus indicators have 3:1 contrast (WCAG 2.2)</li>
          <li>Check button states meet contrast requirements</li>
        </ul>
      </div>
    `;

    UniversalModal.create({
      title: "Colour Contrast Test",
      content: contrastTestContent,
      size: "medium",
      className: "colour-contrast-test",
    }).open();
  }

  /**
   * Test reduced motion preferences
   */
  function testReducedMotion() {
    logInfo(
      "Testing reduced motion preferences - check CSS animations are disabled when prefers-reduced-motion is set"
    );

    const motionTestContent = `
      <div class="motion-test-content">
        <h3>Reduced Motion Test</h3>
        <p>This test verifies that animations respect user motion preferences.</p>
        
        <div style="margin: 1rem 0; padding: 1rem; border: 1px solid #ccc;">
          <h4>Current Motion Preference:</h4>
          <p id="motion-preference-status">Checking...</p>
        </div>
        
        <div style="margin: 1rem 0;">
          <h4>Instructions:</h4>
          <ol>
            <li>Check if modal opened with/without animation based on system preference</li>
            <li>In browser settings, toggle "prefers-reduced-motion"</li>
            <li>Verify animations are disabled when reduced motion is preferred</li>
            <li>Check that backdrop blur is also disabled for motion sensitivity</li>
          </ol>
        </div>
        
        <div style="margin: 1rem 0;">
          <button type="button" id="motion-test-btn" class="modal-action-button">
            Test Button Transitions
          </button>
        </div>
      </div>
    `;

    const modal = UniversalModal.create({
      title: "Reduced Motion Test",
      content: motionTestContent,
      size: "medium",
      className: "reduced-motion-test",
      onOpen: function (modalInstance) {
        // Check motion preference
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        ).matches;
        const statusElement = modalInstance.modal.querySelector(
          "#motion-preference-status"
        );

        statusElement.textContent = prefersReducedMotion
          ? "User prefers reduced motion - animations should be disabled"
          : "User accepts motion - animations should be enabled";

        logInfo(
          `Motion preference: ${prefersReducedMotion ? "reduced" : "normal"}`
        );

        // Test button transitions
        const testBtn = modalInstance.modal.querySelector("#motion-test-btn");
        testBtn.addEventListener("mouseenter", function () {
          logDebug(
            "Button hover - check if transition respects motion preference"
          );
        });
      },
    });

    modal.open();
  }

  /**
   * Test target size compliance (WCAG 2.2 AA)
   */
  function testTargetSize() {
    const targetSizeContent = `
      <div class="target-size-test">
        <h3>Target Size Test (WCAG 2.2)</h3>
        <p>Testing minimum target size of 24x24 CSS pixels for interactive elements.</p>
        
        <div style="margin: 1rem 0;">
          <h4>Standard Buttons (Should meet 24x24px minimum):</h4>
          <button type="button" class="modal-action-button">Normal Button</button>
          <button type="button" class="modal-close-button" style="position: relative;">×</button>
        </div>
        
        <div style="margin: 1rem 0;">
          <h4>Small Interactive Elements (Test edge cases):</h4>
          <a href="#" onclick="event.preventDefault();" style="padding: 0.25rem;">Small Link</a>
          <input type="checkbox" id="small-checkbox" style="margin: 0.5rem;">
          <label for="small-checkbox">Checkbox</label>
        </div>
        
        <div style="margin: 1rem 0;">
          <h4>Testing Instructions:</h4>
          <ul>
            <li>Use browser dev tools to measure interactive elements</li>
            <li>Verify all targets are at least 24x24 CSS pixels</li>
            <li>Check spacing between adjacent targets</li>
            <li>Test touch interaction on mobile devices</li>
          </ul>
        </div>
      </div>
    `;

    UniversalModal.create({
      title: "Target Size Compliance Test",
      content: targetSizeContent,
      size: "medium",
      className: "target-size-test",
      onOpen: function (modalInstance) {
        // Measure interactive elements
        const interactiveElements = modalInstance.modal.querySelectorAll(
          'button, a, input[type="checkbox"]'
        );

        interactiveElements.forEach((element, index) => {
          const rect = element.getBoundingClientRect();
          const meetsRequirement = rect.width >= 24 && rect.height >= 24;

          logInfo(
            `Element ${index + 1} (${element.tagName}): ${rect.width.toFixed(
              1
            )}x${rect.height.toFixed(1)}px - ${
              meetsRequirement ? "PASS" : "FAIL"
            }`
          );
        });
      },
    });

    modal.open();
  }

  // ====== WCAG 2.2 TESTING CHECKLIST ======

  /**
   * Generate WCAG 2.2 testing checklist
   */
  function showWCAGChecklist() {
    const checklistContent = `
      <div class="wcag-checklist">
        <h3>WCAG 2.2 AA Testing Checklist for Modals</h3>
        
        <details open>
          <summary><strong>Perceivable</strong></summary>
          <ul>
            <li>✓ Text has 4.5:1 contrast ratio (3:1 for large text)</li>
            <li>✓ Focus indicators have 3:1 contrast (new in 2.2)</li>
            <li>✓ Images have alt text</li>
            <li>✓ Content is responsive and scales to 200%</li>
            <li>✓ Audio/video has captions (if applicable)</li>
          </ul>
        </details>
        
        <details open>
          <summary><strong>Operable</strong></summary>
          <ul>
            <li>✓ All functionality available via keyboard</li>
            <li>✓ Focus is trapped within modal</li>
            <li>✓ Focus visible for keyboard users</li>
            <li>✓ Target size minimum 24x24px (new in 2.2)</li>
            <li>✓ No seizure-inducing content</li>
            <li>✓ Respects prefers-reduced-motion</li>
          </ul>
        </details>
        
        <details open>
          <summary><strong>Understandable</strong></summary>
          <ul>
            <li>✓ Language is specified</li>
            <li>✓ Content is readable and understandable</li>
            <li>✓ Navigation is consistent</li>
            <li>✓ Error messages are descriptive</li>
            <li>✓ Labels and instructions are clear</li>
          </ul>
        </details>
        
        <details open>
          <summary><strong>Robust</strong></summary>
          <ul>
            <li>✓ Valid HTML markup</li>
            <li>✓ ARIA attributes correctly implemented</li>
            <li>✓ Compatible with assistive technologies</li>
            <li>✓ Works across different browsers</li>
          </ul>
        </details>
        
        <details open>
          <summary><strong>WCAG 2.2 New Success Criteria</strong></summary>
          <ul>
            <li>✓ <strong>Focus Appearance (AA):</strong> Focus indicators meet contrast and size requirements</li>
            <li>✓ <strong>Focus Not Obscured (AA):</strong> Focused elements not completely hidden</li>
            <li>✓ <strong>Dragging Movements (AA):</strong> Alternative to drag operations (if applicable)</li>
          </ul>
        </details>
      </div>
    `;

    UniversalModal.create({
      title: "WCAG 2.2 AA Testing Checklist",
      content: checklistContent,
      size: "large",
      className: "wcag-checklist-modal",
    }).open();
  }

  // ====== TEST RUNNERS ======

  /**
   * Original test runner
   */
  function runModalTests() {
    logInfo("🔍 Running Universal Modal Integration Tests...");

    if (!window.UniversalModal) {
      logError(
        "❌ UniversalModal not found! Make sure universal-modal.js is loaded."
      );
      return false;
    }

    logInfo("✅ UniversalModal is available");

    // Test basic functionality
    setTimeout(() => {
      logInfo("Testing basic alert...");
      testModalAlert();
    }, 1000);

    setTimeout(() => {
      logInfo("Testing confirmation...");
      testModalConfirm();
    }, 3000);

    setTimeout(() => {
      logInfo("Testing custom modal...");
      testCustomModal();
    }, 5000);

    logInfo("🎯 Tests queued. Check the modals that appear!");
    return true;
  }

  /**
   * Run all accessibility tests in sequence
   */
  function runAccessibilityTests() {
    logInfo("🚀 Starting comprehensive accessibility test suite...");

    const tests = [
      { name: "Long Content", fn: testLongContent, delay: 2000 },
      { name: "Very Long Text", fn: testVeryLongText, delay: 4000 },
      { name: "Mixed Content", fn: testMixedContent, delay: 6000 },
      { name: "Focus Management", fn: testFocusManagement, delay: 8000 },
      { name: "ARIA Attributes", fn: testARIAAttributes, delay: 10000 },
      { name: "Colour Contrast", fn: testColourContrast, delay: 12000 },
      { name: "Reduced Motion", fn: testReducedMotion, delay: 14000 },
      { name: "Target Size", fn: testTargetSize, delay: 16000 },
      { name: "Viewport Sizes", fn: testViewportSizes, delay: 18000 },
    ];

    logInfo(`📋 Queued ${tests.length} accessibility tests`);

    tests.forEach((test, index) => {
      setTimeout(() => {
        logInfo(`🔍 Running test ${index + 1}/${tests.length}: ${test.name}`);
        test.fn();
      }, test.delay);
    });

    // Final completion message
    setTimeout(() => {
      logInfo(
        "✅ All accessibility tests queued! Review each modal for compliance."
      );
      if (window.UniversalNotifications) {
        UniversalNotifications.success(
          "Accessibility test suite completed! Check console for detailed results."
        );
      }
    }, 20000);
  }

  /**
   * Quick accessibility check
   */
  function quickAccessibilityCheck() {
    logInfo("🔍 Running quick accessibility check...");

    // Check if required APIs are available
    const checks = {
      modalSystem: !!window.UniversalModal,
      mediaQueries: !!window.matchMedia,
      focusManagement: !!document.activeElement,
      ariaSupport: !!document.createElement("div").setAttribute,
      reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
        .matches,
    };

    logInfo("📊 Quick Accessibility Check Results:");
    Object.keys(checks).forEach((check) => {
      logInfo(`  ${check}: ${checks[check] ? "✅ Available" : "❌ Missing"}`);
    });

    // Test basic modal
    setTimeout(() => {
      UniversalModal.alert(
        "Quick accessibility check completed. See console for detailed results.",
        "Accessibility Check",
        { className: "quick-a11y-check" }
      );
    }, 1000);
  }

  /**
   * Run comprehensive test suite combining original and accessibility tests
   */
  function runAllTests() {
    logInfo(
      "🚀 Running complete modal test suite (basic functionality + accessibility)..."
    );

    // Run basic tests first
    setTimeout(() => {
      logInfo("Phase 1: Basic functionality tests");
      runModalTests();
    }, 1000);

    // Then run accessibility tests
    setTimeout(() => {
      logInfo("Phase 2: Accessibility tests");
      runAccessibilityTests();
    }, 8000);

    logInfo(
      "📋 Complete test suite queued! Check console and modals for results."
    );
  }

  // ====== INITIALIZATION ======

  // Auto-run integration check when this script loads
  function initialize() {
    setTimeout(() => {
      logInfo("🔧 Complete Modal Testing Suite loaded");
      logInfo("📋 Basic Test Commands:");
      logInfo("  • runModalTests() - Original basic functionality tests");
      logInfo("  • testModalAlert() / testModalConfirm() / testCustomModal()");
      logInfo("  • testModalSizes() / testModalErrorHandling()");
      logInfo("");
      logInfo("📋 Accessibility Test Commands:");
      logInfo("  • runAccessibilityTests() - Full accessibility test suite");
      logInfo("  • quickAccessibilityCheck() - Quick validation");
      logInfo("  • showWCAGChecklist() - Testing checklist");
      logInfo("  • testFocusManagement() / testARIAAttributes()");
      logInfo("  • testLongContent() / testViewportSizes()");
      logInfo("");
      logInfo("📋 Comprehensive Commands:");
      logInfo(
        "  • runAllTests() - Complete test suite (basic + accessibility)"
      );
      logInfo("");
      logInfo("- UniversalModal available:", !!window.UniversalModal);
    }, 1000);
  }

  // Initialize when DOM is ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
  } else {
    initialize();
  }

  // ====== PUBLIC API ======
  return {
    // Basic functionality tests
    testModalAlert: testModalAlert,
    testModalConfirm: testModalConfirm,
    testCustomModal: testCustomModal,
    testModalErrorHandling: testModalErrorHandling,
    testModalSizes: testModalSizes,

    // Usage examples
    exampleErrorConfirm: exampleErrorConfirm,
    exampleSuccessAlert: exampleSuccessAlert,
    exampleLoadingModal: exampleLoadingModal,

    // Integration helpers
    safeConfirm: safeConfirm,
    safeAlert: safeAlert,
    wrapWithModalConfirm: wrapWithModalConfirm,

    // Accessibility tests - Content
    testLongContent: testLongContent,
    testVeryLongText: testVeryLongText,
    testMixedContent: testMixedContent,

    // Accessibility tests - Viewport
    testViewportSizes: testViewportSizes,
    testSmallViewport: testSmallViewport,

    // Accessibility tests - Focus
    testFocusManagement: testFocusManagement,
    testARIAAttributes: testARIAAttributes,

    // Accessibility tests - Visual
    testColourContrast: testColourContrast,
    testReducedMotion: testReducedMotion,
    testTargetSize: testTargetSize,

    // WCAG testing
    showWCAGChecklist: showWCAGChecklist,

    // Test runners
    runModalTests: runModalTests,
    runAccessibilityTests: runAccessibilityTests,
    quickAccessibilityCheck: quickAccessibilityCheck,
    runAllTests: runAllTests,
  };
})();

// Export for environments that support it
if (typeof module !== "undefined" && module.exports) {
  module.exports = UniversalModalTests;
}

// For AMD (RequireJS) environments
if (typeof define === "function" && define.amd) {
  define(function () {
    return UniversalModalTests;
  });
}

// Make available globally by attaching functions to window
Object.keys(UniversalModalTests).forEach(function (key) {
  window[key] = UniversalModalTests[key];
});
