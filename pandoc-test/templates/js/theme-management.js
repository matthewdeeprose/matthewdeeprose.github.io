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
        
        // Update theme toggle UI
        if (theme === "dark") {
            if (themeIcon) themeIcon.textContent = "☀️";
            if (themeText) themeText.textContent = "Light";
            if (themeToggle) themeToggle.setAttribute("aria-label", "Switch to light mode");
        } else {
            if (themeIcon) themeIcon.textContent = "🌙";
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