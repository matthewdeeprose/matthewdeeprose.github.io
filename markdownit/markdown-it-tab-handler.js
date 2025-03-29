document.addEventListener('DOMContentLoaded', function() {
  // Function to handle tab switching
  function setupTabListeners() {
    const tabsWrappers = document.querySelectorAll('.tabs-tabs-wrapper');
    
    tabsWrappers.forEach(wrapper => {
      // Set appropriate ARIA roles and properties
      const header = wrapper.querySelector('.tabs-tabs-header');
      if (header) {
        header.setAttribute('role', 'tablist');
      }
      
      // Get wrapper ID if available
      const wrapperId = wrapper.getAttribute('data-id');
      
      const tabButtons = wrapper.querySelectorAll('.tabs-tab-button');
      const tabContents = wrapper.querySelectorAll('.tabs-tab-content');
      
      // Generate unique IDs for this tab set if needed
      const tabsetId = wrapperId || `tabset-${Math.random().toString(36).substr(2, 9)}`;
      
      tabButtons.forEach((button, index) => {
        const tabId = `${tabsetId}-tab-${index}`;
        const panelId = `${tabsetId}-panel-${index}`;
        
        // Get button's data-id if available
        const buttonId = button.getAttribute('data-id');
        
        // Set ARIA attributes for buttons
        button.setAttribute('role', 'tab');
        button.setAttribute('id', tabId);
        button.setAttribute('aria-controls', panelId);
        button.setAttribute('aria-selected', button.classList.contains('active') ? 'true' : 'false');
        button.setAttribute('tabindex', button.classList.contains('active') ? '0' : '-1');
        
        // Set ARIA attributes for content panels
        const content = tabContents[index];
        if (content) {
          content.setAttribute('role', 'tabpanel');
          content.setAttribute('id', panelId);
          content.setAttribute('aria-labelledby', tabId);
          if (!content.classList.contains('active')) {
            content.setAttribute('tabindex', '-1');
          }
        }
        
        // Add keyboard navigation
        button.addEventListener('keydown', function(e) {
          let targetButton = null;
          
          switch (e.key) {
            case 'ArrowLeft':
              targetButton = button.previousElementSibling || tabButtons[tabButtons.length - 1];
              break;
            case 'ArrowRight':
              targetButton = button.nextElementSibling || tabButtons[0];
              break;
            case 'Home':
              targetButton = tabButtons[0];
              break;
            case 'End':
              targetButton = tabButtons[tabButtons.length - 1];
              break;
          }
          
          if (targetButton) {
            e.preventDefault();
            targetButton.click();
            targetButton.focus();
          }
        });
        
        // Click event for switching tabs
        button.addEventListener('click', function() {
          const tabIndex = this.getAttribute('data-tab');
          
          // Deactivate all tabs in this container
          tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');
            btn.removeAttribute('data-active');
          });
          
          tabContents.forEach(content => {
            content.classList.remove('active');
            content.removeAttribute('data-active');
          });
          
          // Activate this tab
          button.classList.add('active');
          button.setAttribute('aria-selected', 'true');
          button.setAttribute('tabindex', '0');
          button.setAttribute('data-active', '');
          
          const tabContent = tabContents[index];
          if (tabContent) {
            tabContent.classList.add('active');
            tabContent.setAttribute('data-active', '');
          }
          
          // If this tab has an ID, switch all tabs with the same ID
          if (buttonId) {
            // Find all tab buttons with the same ID
            document.querySelectorAll(`.tabs-tab-button[data-id="${buttonId}"]`).forEach(otherButton => {
              // Skip the current button
              if (otherButton === button) return;
              
              // Get the tab container and index
              const otherWrapper = otherButton.closest('.tabs-tabs-wrapper');
              if (!otherWrapper) return;
              
              const otherIndex = otherButton.getAttribute('data-tab');
              
              // Deactivate all tabs in the other container
              const otherButtons = otherWrapper.querySelectorAll('.tabs-tab-button');
              otherButtons.forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
                btn.setAttribute('tabindex', '-1');
                btn.removeAttribute('data-active');
              });
              
              // Deactivate all contents in the other container
              const otherContents = otherWrapper.querySelectorAll('.tabs-tab-content');
              otherContents.forEach(content => {
                content.classList.remove('active');
                content.removeAttribute('data-active');
              });
              
              // Activate the corresponding tab and content
              otherButton.classList.add('active');
              otherButton.setAttribute('aria-selected', 'true');
              otherButton.setAttribute('tabindex', '0');
              otherButton.setAttribute('data-active', '');
              
              const otherContent = otherWrapper.querySelector(`.tabs-tab-content[data-index="${otherIndex}"]`);
              if (otherContent) {
                otherContent.classList.add('active');
                otherContent.setAttribute('data-active', '');
              }
            });
          }
        });
      });
    });
  }

  // Run initial setup
  setupTabListeners();
  
  // Set up a MutationObserver to handle dynamically added tabs
  const observer = new MutationObserver(mutations => {
    let shouldSetup = false;
    
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === 1 && 
              (node.classList.contains('tabs-tabs-wrapper') || 
               node.querySelector('.tabs-tabs-wrapper'))) {
            shouldSetup = true;
          }
        });
      }
    });
    
    if (shouldSetup) {
      setupTabListeners();
    }
  });
  
  // Observe changes to the output element
  const output = document.getElementById('output');
  if (output) {
    observer.observe(output, { childList: true, subtree: true });
  }
});