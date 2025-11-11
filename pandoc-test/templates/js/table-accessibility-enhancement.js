// Enhanced Table Accessibility Enhancement Script
(function() {
  'use strict';
  
  function initializeTableAccessibility() {
    try {
      // Wait for DOM to be ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeTableAccessibility);
        return;
      }
      
      console.log('Initializing table accessibility enhancements...');
      
      // Add comprehensive ARIA attributes (Adrian Roselli method)
      let tableCount = 0;
      const tables = document.querySelectorAll('table');
      
      tables.forEach((table, index) => {
        // Add ARIA roles
        table.setAttribute('role', 'table');
        
        // Process captions
        const caption = table.querySelector('caption');
        if (caption) {
          caption.setAttribute('role', 'caption');
        }
        
        // Process row groups
        table.querySelectorAll('thead, tbody, tfoot').forEach(group => {
          group.setAttribute('role', 'rowgroup');
        });
        
        // Process rows
        table.querySelectorAll('tr').forEach(row => {
          row.setAttribute('role', 'row');
        });
        
        // Process cells
        table.querySelectorAll('td').forEach(cell => {
          cell.setAttribute('role', 'cell');
        });
        
        // Process headers
        table.querySelectorAll('th').forEach(header => {
          if (header.getAttribute('scope') === 'row') {
            header.setAttribute('role', 'rowheader');
          } else {
            header.setAttribute('role', 'columnheader');
          }
        });
        
        // Generate data-label attributes for mobile responsive design
        const headerRow = table.querySelector('thead tr, tr:first-child');
        if (headerRow) {
          const headers = Array.from(headerRow.querySelectorAll('th, td'))
            .map(header => header.textContent.trim());
            
          table.querySelectorAll('tbody tr, tr:not(:first-child)').forEach(row => {
            row.querySelectorAll('td, th').forEach((cell, cellIndex) => {
              if (headers[cellIndex]) {
                cell.setAttribute('data-label', headers[cellIndex]);
              }
            });
          });
        }
        
        // Add table description for screen readers
        if (!table.getAttribute('aria-describedby')) {
          const rows = table.querySelectorAll('tr').length;
          const cols = headerRow ? headerRow.querySelectorAll('th, td').length : 0;
          
          const description = document.createElement('div');
          description.className = 'table-description sr-only';
          description.id = 'table-desc-' + (index + 1);
          description.textContent = 'Data table with ' + rows + ' rows and ' + cols + ' columns';
          
          table.parentNode.insertBefore(description, table);
          table.setAttribute('aria-describedby', description.id);
        }
        
        tableCount++;
      });
      
      console.log('✅ Table accessibility enhancement complete: ' + tableCount + ' tables processed');
      
      // Announce to screen readers if function is available
      if (typeof announceToScreenReader === 'function') {
        announceToScreenReader(tableCount + ' tables enhanced for accessibility with ARIA labels and responsive design');
      }
      
    } catch (error) {
      console.error('Error enhancing table accessibility:', error);
    }
  }
  
  // Initialize immediately or wait for DOM
  initializeTableAccessibility();
})();