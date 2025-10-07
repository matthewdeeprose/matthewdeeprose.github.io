/**
 * @module a11y
 * @description Accessibility helper functions
 */

export const a11y = {
  /**
   * Announce a message to screen readers
   * @param {string} message - The message to announce
   * @param {string} [priority='polite'] - The priority of the announcement ('polite' or 'assertive')
   */
  announceStatus: function(message, priority = 'polite') {
    console.log(`Screen reader announcement (${priority}): ${message}`);
    
    // Create or get the announcer element
    let announcer = document.getElementById('sr-announcer');
    
    if (!announcer) {
      announcer = document.createElement('div');
      announcer.id = 'sr-announcer';
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-live', priority);
      announcer.setAttribute('aria-atomic', 'true');
      document.body.appendChild(announcer);
    }
    
    // Set the priority if it's changed
    if (announcer.getAttribute('aria-live') !== priority) {
      announcer.setAttribute('aria-live', priority);
    }
    
    // Announcer text strategy: clear and re-add to ensure announcement
    announcer.textContent = '';
    setTimeout(() => {
      announcer.textContent = message;
    }, 50);
  },
  
  /**
   * Check if the user prefers reduced motion
   * @returns {boolean} True if reduced motion is preferred
   */
  prefersReducedMotion: function() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  },
  
  /**
   * Set up a watcher for motion preference changes
   * @param {Function} callback - Function to call when preference changes
   * @returns {Function} Function to remove the watcher
   */
  watchMotionPreference: function(callback) {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    
    // Initial call with current state
    callback(mediaQuery.matches);
    
    // Modern event listener
    function handleChange() {
      callback(mediaQuery.matches);
    }
    
    mediaQuery.addEventListener('change', handleChange);
    
    // Return function to remove listener
    return function() {
      mediaQuery.removeEventListener('change', handleChange);
    };
  },
  
  /**
   * Focus an element with improved user experience
   * @param {HTMLElement} element - Element to focus
   * @param {Object} options - Focus options
   */
  focusElement: function(element, options = {}) {
    if (!element) return;
    
    // Save current scroll position
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    
    // Focus the element
    element.focus(options);
    
    // Restore scroll position if preventScroll wasn't set
    if (!options.preventScroll) {
      window.scrollTo(scrollX, scrollY);
    }
  },
  
  /**
   * Trap focus within a container
   * @param {HTMLElement} container - Container to trap focus within
   * @returns {Function} Function to remove the trap
   */
  trapFocus: function(container) {
    if (!container) return () => {};
    
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return () => {};
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    function handleKeyDown(e) {
      if (e.key !== 'Tab') return;
      
      if (e.shiftKey && document.activeElement === firstElement) {
        e.preventDefault();
        lastElement.focus();
      } else if (!e.shiftKey && document.activeElement === lastElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
    
    container.addEventListener('keydown', handleKeyDown);
    
    // Return function to remove trap
    return function() {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }
};
