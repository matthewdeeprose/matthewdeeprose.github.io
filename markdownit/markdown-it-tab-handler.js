document.addEventListener('DOMContentLoaded', function() {
  // Function to handle tab switching
  function setupTabListeners() {
    const tabsWrappers = document.querySelectorAll('.tabs-tabs-wrapper');
    
    tabsWrappers.forEach(wrapper => {
      // Set appropriate ARIA roles and properties
      wrapper.querySelector('.tabs-tabs-header').setAttribute('role', 'tablist');
      
      const tabButtons = wrapper.querySelectorAll('.tabs-tab-button');
      const tabContents = wrapper.querySelectorAll('.tabs-tab-content');
      
      // Generate unique IDs for this tab set if needed
      const tabsetId = `tabset-${Math.random().toString(36).substr(2, 9)}`;
      
      tabButtons.forEach((button, index) => {
        const tabId = `${tabsetId}-tab-${index}`;
        const panelId = `${tabsetId}-panel-${index}`;
        
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
          // Deactivate all tabs
          tabButtons.forEach(btn => {
            btn.classList.remove('active');
            btn.setAttribute('aria-selected', 'false');
            btn.setAttribute('tabindex', '-1');
          });
          
          tabContents.forEach(content => {
            content.classList.remove('active');
          });
          
          // Activate this tab
          button.classList.add('active');
          button.setAttribute('aria-selected', 'true');
          button.setAttribute('tabindex', '0');
          
          if (content) {
            content.classList.add('active');
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