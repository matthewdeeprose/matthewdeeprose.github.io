document.addEventListener('DOMContentLoaded', function() {
  // Function to handle tab switching
  function setupTabListeners() {
    const tabButtons = document.querySelectorAll('.tabs-tab-button');
    
    tabButtons.forEach(button => {
      button.addEventListener('click', function() {
        const tabIndex = this.getAttribute('data-tab');
        const tabsWrapper = this.closest('.tabs-tabs-wrapper');
        
        // Deactivate all tabs and buttons
        tabsWrapper.querySelectorAll('.tabs-tab-button').forEach(btn => {
          btn.classList.remove('active');
          btn.removeAttribute('data-active');
        });
        
        tabsWrapper.querySelectorAll('.tabs-tab-content').forEach(content => {
          content.classList.remove('active');
          content.removeAttribute('data-active');
        });
        
        // Activate selected tab and button
        this.classList.add('active');
        this.setAttribute('data-active', '');
        
        const tabContent = tabsWrapper.querySelector(`.tabs-tab-content[data-index="${tabIndex}"]`);
        if (tabContent) {
          tabContent.classList.add('active');
          tabContent.setAttribute('data-active', '');
        }
      });
    });
  }

  // Run initial setup
  setupTabListeners();
  
  // Set up a MutationObserver to handle dynamically added tabs
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      if (mutation.addedNodes.length) {
        setupTabListeners();
      }
    });
  });
  
  // Observe changes to the output element
  const output = document.getElementById('output');
  if (output) {
    observer.observe(output, { childList: true, subtree: true });
  }
});