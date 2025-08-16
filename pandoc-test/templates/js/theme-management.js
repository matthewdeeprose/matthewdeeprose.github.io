// templates/js/theme-management.js
// Theme Management and Dark/Light Mode Controls
// Migrated from: export-manager.js generateThemeManagementJS()
// ✅ PHASE 2A STEP 3: External JavaScript Template

// Enhanced Theme Management with System Preference Support
(function() {
    'use strict';
    
    // Theme configuration
    const THEME_CONFIG = {
        defaultTheme: '{{defaultTheme}}',
        storageKey: 'user-theme',
        enableTransitions: {{enableTransitions}},
        respectSystemPreference: {{respectSystemPreference}}
    };

    // Get DOM elements
    const themeToggle = document.getElementById("theme-toggle");
    const themeIcon = themeToggle?.querySelector(".theme-toggle-icon");
    const themeText = themeToggle?.querySelector(".theme-toggle-text");

    /**
     * Get user's preferred theme based on storage and system preferences
     * @returns {string} 'light' or 'dark'
     */
    function getPreferredTheme() {
        // Check stored preference first
        const stored = localStorage.getItem(THEME_CONFIG.storageKey);
        if (stored) return stored;
        
        {{#if respectSystemPreference}}
        // Check system preference if enabled
        if (window.matchMedia("(prefers-color-scheme: dark)").matches) return "dark";
        if (window.matchMedia("(prefers-color-scheme: light)").matches) return "light";
        {{/if}}
        
        // Default fallback
        return THEME_CONFIG.defaultTheme;
    }

    /**
     * Set theme and update UI elements
     * @param {string} theme - 'light' or 'dark'
     */
    function setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.warn('Invalid theme:', theme, 'defaulting to light');
            theme = 'light';
        }

        // Apply theme to document
        document.documentElement.setAttribute("data-theme", theme);
        
        // Store preference
        localStorage.setItem(THEME_CONFIG.storageKey, theme);
        
// SVG icon definitions
        const lightModeIcon = `<svg height="24" width="24" viewBox="0 0 21 21" class="action-icon theme-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g fill="none" fill-rule="evenodd" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(-210 -1)"><g opacity=".3" transform="matrix(.96592583 .25881905 -.25881905 .96592583 214.136029 .477376)"><path d="m9 13c2.2190012 0 4-1.7631416 4-3.98214286 0-2.21900122-1.7809988-4.01785714-4-4.01785714-2.21900123 0-4 1.78099877-4 4 0 2.2190012 1.78099877 4 4 4z" transform="matrix(.96592583 -.25881905 .25881905 .96592583 -2.022704 2.636039)"/><g transform="matrix(.8660254 .5 -.5 .8660254 1.4558 4.066879)"><path d="m0 .5h2"/><path d="m16 .5h2"/></g><g transform="matrix(.96592583 -.25881905 .25881905 .96592583 .17726 10.84642)"><path d="m0 .5h2"/><path d="m16 .5h2"/></g><g transform="matrix(.5 -.8660254 .8660254 .5 4.066879 16.544042)"><path d="m0 .5h2"/><path d="m16 .5h2"/></g><g transform="matrix(-.25881905 -.96592583 .96592583 -.25881905 10.846233 17.822607)"><path d="m0 .5h2"/><path d="m16 .5h2"/></g></g><g><path d="m220.5 2.5v2"/><path d="m227 5-1.5 1.5"/><circle cx="220.5" cy="11.5" r="4"/><path d="m214 5 1.5 1.5"/><path d="m220.5 20.5v-2"/><path d="m227 18-1.5-1.5"/><path d="m214 18 1.5-1.5"/><path d="m211.5 11.5h2"/><path d="m227.5 11.5h2"/></g></g></svg>`;
        
        const darkModeIcon = `<svg height="24" width="24" viewBox="0 0 21 21" class="action-icon theme-icon" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><path d="m7.5.5c1.3280962 0 2.5698071.36985953 3.6277499 1.01219586-3.14075981.19184303-5.6277499 2.79938976-5.6277499 5.98780414 0 3.1884144 2.48699009 5.7959611 5.6269199 5.9885898-1.0571128.6415507-2.2988237 1.0114102-3.6269199 1.0114102-3.86599325 0-7-3.1340068-7-7 0-3.86599325 3.13400675-7 7-7z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" transform="translate(4 3)"/></svg>`;

        // Update theme toggle UI
        if (theme === "dark") {
            if (themeIcon) themeIcon.innerHTML = lightModeIcon;
            if (themeText) themeText.textContent = "Light";
            if (themeToggle) themeToggle.setAttribute("aria-label", "Switch to light mode");
        } else {
            if (themeIcon) themeIcon.innerHTML = darkModeIcon;
            if (themeText) themeText.textContent = "Dark";
            if (themeToggle) themeToggle.setAttribute("aria-label", "Switch to dark mode");
        }

        // Update aria-pressed state for better accessibility
        if (themeToggle) {
            themeToggle.setAttribute('aria-pressed', theme === 'dark');
        }
        
        // Announce theme change to screen readers
        announceThemeChange(theme);
        
        console.log("✅ Theme set to:", theme);
    }

    /**
     * Toggle between light and dark themes
     * @returns {string} The new theme that was set
     */
    function toggleTheme() {
        const current = document.documentElement.getAttribute("data-theme") || "light";
        const newTheme = current === "light" ? "dark" : "light";
        setTheme(newTheme);
        return newTheme;
    }

    /**
     * Announce theme change to screen readers
     * @param {string} theme - The new theme
     */
    function announceThemeChange(theme) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('role', 'status');
        announcement.textContent = `Theme changed to ${theme} mode`;
        
        // Screen reader only styles
        announcement.style.cssText = `
            position: absolute !important;
            width: 1px !important;
            height: 1px !important;
            padding: 0 !important;
            margin: -1px !important;
            overflow: hidden !important;
            clip: rect(0, 0, 0, 0) !important;
            white-space: nowrap !important;
            border: 0 !important;
        `;
        
        document.body.appendChild(announcement);
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }

    {{#if enableTransitions}}
    /**
     * Setup smooth transitions for theme changes
     */
    function setupThemeTransitions() {
        // Check for reduced motion preference
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            console.log('⚠️ Respecting reduced motion preference - transitions disabled');
            return;
        }

        const style = document.createElement('style');
        style.id = 'theme-transitions';
        style.textContent = `
            :root {
                transition: background-color 0.3s ease, color 0.3s ease;
            }
            body {
                transition: background-color 0.3s ease, color 0.3s ease;
            }
            .theme-toggle {
                transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
            }
        `;
        document.head.appendChild(style);
        console.log('✅ Theme transitions enabled');
    }
    {{/if}}

    /**
     * Initialize theme management system
     */
    function initializeThemeSystem() {
        console.log('🎨 Initializing theme management system...');
        
        {{#if enableTransitions}}
        setupThemeTransitions();
        {{/if}}
        
        // Set initial theme
        const initialTheme = getPreferredTheme();
        setTheme(initialTheme);
        
        // Setup theme toggle button
        if (themeToggle) {
            // Click handler
            themeToggle.addEventListener("click", function(event) {
                event.preventDefault();
                toggleTheme();
            });
            
            // Keyboard support (Enter and Space)
            themeToggle.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleTheme();
                }
            });
            
            console.log('✅ Theme toggle button initialized with full keyboard support');
        }
        
        {{#if respectSystemPreference}}
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            
            // Use modern addListener or addEventListener based on availability
            const addListener = mediaQuery.addEventListener || mediaQuery.addListener;
            if (addListener) {
                const handler = function(e) {
                    // Only auto-switch if user hasn't manually set a preference
                    if (!localStorage.getItem(THEME_CONFIG.storageKey)) {
                        setTheme(e.matches ? 'dark' : 'light');
                        console.log('🔄 Auto-switched theme based on system preference:', e.matches ? 'dark' : 'light');
                    }
                };
                
                if (mediaQuery.addEventListener) {
                    mediaQuery.addEventListener('change', handler);
                } else {
                    mediaQuery.addListener(handler);
                }
                
                console.log('✅ System theme preference monitoring enabled');
            }
        }
        {{/if}}
        
        console.log('✅ Theme management system fully initialized');
        
        // Log current configuration for debugging
        console.log('🎨 Theme Configuration:', {
            defaultTheme: THEME_CONFIG.defaultTheme,
            enableTransitions: THEME_CONFIG.enableTransitions,
            respectSystemPreference: THEME_CONFIG.respectSystemPreference,
            currentTheme: document.documentElement.getAttribute("data-theme")
        });
    }

    // Export functions for global access
    window.setTheme = setTheme;
    window.getPreferredTheme = getPreferredTheme;
    window.toggleTheme = toggleTheme;

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeThemeSystem);
    } else {
        initializeThemeSystem();
    }

    console.log('✅ Theme management module loaded');
})();