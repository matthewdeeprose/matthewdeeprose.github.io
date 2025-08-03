// templates/js/form-initialization.js
// Form Initialization JavaScript Template
// Purpose: Generate form setup, validation, and accessibility JavaScript for exported HTML files
// Migration target: export-manager.js generateFormInitializationJS()

// Initialize form default values
function initializeFormDefaults() {
    const fontSizeInput = document.getElementById("font-size");
    const fontSizeValue = document.getElementById("font-size-value");
    if (fontSizeInput && fontSizeValue) {
        fontSizeInput.value = "{{defaultFontSize}}";
        fontSizeValue.textContent = "{{defaultFontSizePercent}}";
    }

    const lineHeightInput = document.getElementById("line-height");
    if (lineHeightInput) {
        lineHeightInput.value = "{{defaultLineHeight}}";
    }

    const wordSpacingInput = document.getElementById("word-spacing");
    if (wordSpacingInput) {
        wordSpacingInput.value = "{{defaultWordSpacing}}";
    }

    const readingWidthSelect = document.getElementById("reading-width");
    if (readingWidthSelect) {
        readingWidthSelect.value = "{{defaultReadingWidth}}";
        // Note: Event handlers are managed by ReadingAccessibilityManager class
    }

    const zoomLevelInput = document.getElementById("zoom-level");
    if (zoomLevelInput) {
        zoomLevelInput.value = "{{defaultZoomLevel}}";
    }

    {{#if enableValidation}}
    // Form validation setup
    setupFormValidation();
    {{/if}}

    {{#if enableAccessibility}}
    // Accessibility enhancements
    setupAccessibilityFeatures();
    {{/if}}

    console.log("✅ Form defaults initialised");
}

{{#if enableValidation}}
// Form validation functionality
function setupFormValidation() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!validateForm(this)) {
                event.preventDefault();
                announceFormErrors(this);
            }
        });

        // Real-time validation on input change - EXCLUDE reading-width (managed by ReadingAccessibilityManager)
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            // ✅ FIXED: Skip reading-width to avoid conflicts with ReadingAccessibilityManager
            if (input.id === 'reading-width') {
                return; // Skip - handled by ReadingAccessibilityManager
            }
            
            input.addEventListener('blur', function() {
                validateField(this);
            });
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
        if (!field.value.trim()) {
            markFieldAsInvalid(field, 'This field is required');
            isValid = false;
        } else {
            markFieldAsValid(field);
        }
    });

    return isValid;
}

function validateField(field) {
    if (field.hasAttribute('required') && !field.value.trim()) {
        markFieldAsInvalid(field, 'This field is required');
        return false;
    }
    
    // Type-specific validation
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            markFieldAsInvalid(field, 'Please enter a valid email address');
            return false;
        }
    }
    
    if (field.type === 'number' && field.value) {
        const min = parseFloat(field.getAttribute('min'));
        const max = parseFloat(field.getAttribute('max'));
        const value = parseFloat(field.value);
        
        if (!isNaN(min) && value < min) {
            markFieldAsInvalid(field, `Value must be at least ${min}`);
            return false;
        }
        
        if (!isNaN(max) && value > max) {
            markFieldAsInvalid(field, `Value must be no more than ${max}`);
            return false;
        }
    }
    
    markFieldAsValid(field);
    return true;
}

function markFieldAsInvalid(field, message) {
    field.setAttribute('aria-invalid', 'true');
    field.classList.add('field-invalid');
    
    let errorElement = field.parentNode.querySelector('.field-error');
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        errorElement.setAttribute('role', 'alert');
        errorElement.setAttribute('aria-live', 'polite');
        field.parentNode.appendChild(errorElement);
    }
    
    errorElement.textContent = message;
    errorElement.id = field.id + '-error';
    field.setAttribute('aria-describedby', errorElement.id);
}

function markFieldAsValid(field) {
    field.setAttribute('aria-invalid', 'false');
    field.classList.remove('field-invalid');
    
    const errorElement = field.parentNode.querySelector('.field-error');
    if (errorElement) {
        errorElement.remove();
    }
    
    field.removeAttribute('aria-describedby');
}

function announceFormErrors(form) {
    const invalidFields = form.querySelectorAll('[aria-invalid="true"]');
    if (invalidFields.length > 0) {
        const message = `Please correct ${invalidFields.length} error${invalidFields.length > 1 ? 's' : ''} in the form`;
        announceToScreenReader(message);
    }
}
{{/if}}

{{#if enableAccessibility}}
// Accessibility enhancement functions
function setupAccessibilityFeatures() {
    // Enhanced keyboard navigation
    setupKeyboardNavigation();
    
    // Screen reader announcements
    setupScreenReaderAnnouncements();
    
    // Focus management
    setupFocusManagement();
    
    console.log("✅ Form accessibility features initialized");
}

function setupKeyboardNavigation() {
    const forms = document.querySelectorAll('form');
    forms.forEach(form => {
        form.addEventListener('keydown', function(event) {
            // Enhanced Tab navigation
            if (event.key === 'Tab') {
                handleTabNavigation(event, this);
            }
            
            // Enter key submission
            if (event.key === 'Enter' && event.target.type !== 'textarea') {
                const submitButton = this.querySelector('button[type="submit"], input[type="submit"]');
                if (submitButton && !event.target.closest('button')) {
                    event.preventDefault();
                    submitButton.click();
                }
            }
        });
    });
}

function handleTabNavigation(event, form) {
    const focusableElements = form.querySelectorAll(
        'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    
    if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
    }
}

function setupScreenReaderAnnouncements() {
    // Create live region for announcements
    let liveRegion = document.getElementById('form-announcements');
    if (!liveRegion) {
        liveRegion = document.createElement('div');
        liveRegion.id = 'form-announcements';
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.style.position = 'absolute';
        liveRegion.style.left = '-10000px';
        liveRegion.style.width = '1px';
        liveRegion.style.height = '1px';
        liveRegion.style.overflow = 'hidden';
        document.body.appendChild(liveRegion);
    }
}

function setupFocusManagement() {
    const interactiveElements = document.querySelectorAll('input, select, textarea, button');
    
    interactiveElements.forEach(element => {
        // ✅ FIXED: Skip reading-width to avoid conflicts with ReadingAccessibilityManager
        if (element.id === 'reading-width') {
            return; // Skip - handled by ReadingAccessibilityManager
        }
        
        element.addEventListener('focus', function() {
            // Ensure focused element is visible
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Add focus styling if not present
            if (!this.matches(':focus-visible')) {
                this.classList.add('programmatic-focus');
            }
        });
        
        element.addEventListener('blur', function() {
            this.classList.remove('programmatic-focus');
        });
    });
}

function announceToScreenReader(message) {
    const liveRegion = document.getElementById('form-announcements');
    if (liveRegion) {
        liveRegion.textContent = message;
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }
}
{{/if}}

{{#if enablePreferences}}
// User preference management
function setupUserPreferences() {
    // Save form values to localStorage - EXCLUDE reading-width (managed by ReadingAccessibilityManager)
    const inputs = document.querySelectorAll('input[data-preference], select[data-preference]');
    
    inputs.forEach(input => {
        // ✅ FIXED: Skip reading-width to avoid conflicts with ReadingAccessibilityManager
        if (input.id === 'reading-width') {
            return; // Skip - handled by ReadingAccessibilityManager
        }
        
        // Load saved preference
        const preferenceKey = input.getAttribute('data-preference');
        const savedValue = localStorage.getItem(preferenceKey);
        
        if (savedValue !== null) {
            if (input.type === 'checkbox' || input.type === 'radio') {
                input.checked = savedValue === 'true';
            } else {
                input.value = savedValue;
            }
        }
        
        // Save preference on change
        input.addEventListener('change', function() {
            const value = this.type === 'checkbox' || this.type === 'radio' 
                ? this.checked.toString() 
                : this.value;
            localStorage.setItem(preferenceKey, value);
        });
    });
    
    console.log("✅ User preferences loaded and tracking enabled");
}
{{/if}}

// Initialize all form functionality when DOM is ready
function initializeAllFormFeatures() {
    initializeFormDefaults();
    
    {{#if enablePreferences}}
    setupUserPreferences();
    {{/if}}
    
    console.log("🎯 All form initialization complete");
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAllFormFeatures);
} else {
    initializeAllFormFeatures();
}