// Distraction-Free Mode Controller for Neurodivergent Users
(function() {
    'use strict';
    
    // ===========================================================================================
    // LOGGING CONFIGURATION (IIFE SCOPE)
    // ===========================================================================================

    const LOG_LEVELS = {
        ERROR: 0,
        WARN: 1,
        INFO: 2,
        DEBUG: 3,
    };

    const DEFAULT_LOG_LEVEL = LOG_LEVELS.WARN;
    const ENABLE_ALL_LOGGING = false;
    const DISABLE_ALL_LOGGING = false;

    function shouldLog(level) {
        if (DISABLE_ALL_LOGGING) return false;
        if (ENABLE_ALL_LOGGING) return true;
        return level <= DEFAULT_LOG_LEVEL;
    }

    function logError(message, ...args) {
        if (shouldLog(LOG_LEVELS.ERROR))
            console.error("[DistractionFree]", message, ...args);
    }

    function logWarn(message, ...args) {
        if (shouldLog(LOG_LEVELS.WARN))
            console.warn("[DistractionFree]", message, ...args);
    }

    function logInfo(message, ...args) {
        if (shouldLog(LOG_LEVELS.INFO))
            console.log("[DistractionFree]", message, ...args);
    }

    function logDebug(message, ...args) {
        if (shouldLog(LOG_LEVELS.DEBUG))
            console.log("[DistractionFree]", message, ...args);
    }
    
    class DistractionFreeManager {
        constructor() {
            this.state = {
                tocVisible: true,
                sidebarVisible: true,
                focusMode: false
            };
            this.elements = {
                wrapper: null,
                toc: null,
                sidebar: null,
                content: null,
                announcements: null,
                toggleTocBtn: null,
                toggleSidebarBtn: null,
                focusModeBtn: null
            };
            
            logInfo("DistractionFreeManager initialised");
        }
        
        initialize() {
            try {
                // Get DOM elements
                this.elements.wrapper = document.querySelector('.document-wrapper');
                this.elements.toc = document.querySelector('#toc, .table-of-contents');
                this.elements.sidebar = document.querySelector('#sidebar, .document-sidebar');
                this.elements.content = document.querySelector('.document-content');
                this.elements.announcements = document.getElementById('focus-announcements');
                
                // Get control buttons with null checks
                this.elements.toggleTocBtn = document.getElementById('toggle-toc');
                this.elements.toggleSidebarBtn = document.getElementById('toggle-sidebar');
                this.elements.focusModeBtn = document.getElementById('focus-mode');
                
                // Check if elements exist
                if (!this.elements.wrapper) {
                    logWarn("Document wrapper not found");
                    return false;
                }
                
                // Handle missing TOC button gracefully (when document has no TOC)
                if (!this.elements.toggleTocBtn) {
                    logInfo("TOC toggle button not found - document has no table of contents");
                    this.state.tocVisible = false; // No TOC means it's not visible
                } else {
                    logDebug("TOC toggle button found - document has table of contents");
                }
                
                // Set up event listeners
                this.setupEventListeners();
                
                // Initialize state based on existing elements
                this.state.tocVisible = this.elements.toc && !this.elements.toc.classList.contains('hide-toc');
                this.state.sidebarVisible = this.elements.sidebar && !this.elements.sidebar.classList.contains('hide-sidebar');
                
                // Update button states
                this.updateButtonStates();
                
                logInfo("DistractionFreeManager successfully initialised");
                return true;
            } catch (error) {
                logError("Error initialising DistractionFreeManager:", error);
                return false;
            }
        }
        
        setupEventListeners() {
            // Only add TOC event listener if button exists
            if (this.elements.toggleTocBtn) {
                this.elements.toggleTocBtn.addEventListener('click', () => this.toggleToc());
                logDebug("TOC toggle event listener added");
            } else {
                logDebug("TOC toggle button not present - skipping event listener");
            }
            
            // Sidebar and focus mode buttons should always exist
            if (this.elements.toggleSidebarBtn) {
                this.elements.toggleSidebarBtn.addEventListener('click', () => this.toggleSidebar());
                logDebug("Sidebar toggle event listener added");
            } else {
                logWarn("Sidebar toggle button not found");
            }
            
            if (this.elements.focusModeBtn) {
                this.elements.focusModeBtn.addEventListener('click', () => this.toggleFocusMode());
                logDebug("Focus mode toggle event listener added");
            } else {
                logWarn("Focus mode toggle button not found");
            }
            
            // Keyboard shortcuts (optional enhancement)
            document.addEventListener('keydown', (event) => {
                if (event.ctrlKey && event.altKey) {
                    switch (event.key) {
                        case 't':
                        case 'T':
                            event.preventDefault();
                            this.toggleToc();
                            break;
                        case 's':
                        case 'S':
                            event.preventDefault();
                            this.toggleSidebar();
                            break;
                        case 'f':
                        case 'F':
                            event.preventDefault();
                            this.toggleFocusMode();
                            break;
                    }
                } else if (event.key === 'Escape' && this.state.focusMode) {
                    this.disableFocusMode();
                }
            });
            
            logDebug("Event listeners set up");
        }
        
        toggleToc() {
            if (!this.elements.toc) {
                this.announceChange("Table of contents is not available");
                return;
            }
            
            this.state.tocVisible = !this.state.tocVisible;
            
            if (this.state.tocVisible) {
                this.elements.toc.classList.remove('hide-toc');
                this.announceChange("Table of contents shown");
            } else {
                this.elements.toc.classList.add('hide-toc');
                this.announceChange("Table of contents hidden");
                this.manageFocus(this.elements.toc);
            }
            
            // If focus mode is active, disable it
            if (this.state.focusMode) {
                this.state.focusMode = false;
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.updateIntelligentFocusMode(); 
            logInfo("TOC toggled:", this.state.tocVisible ? "shown" : "hidden");
        }
        
        toggleSidebar() {
            if (!this.elements.sidebar) {
                this.announceChange("Sidebar is not available");
                return;
            }
            
            this.state.sidebarVisible = !this.state.sidebarVisible;
            
            if (this.state.sidebarVisible) {
                this.elements.sidebar.classList.remove('hide-sidebar');
                this.announceChange("Tools and settings shown");
            } else {
                this.elements.sidebar.classList.add('hide-sidebar');
                this.announceChange("Tools and settings hidden");
                this.manageFocus(this.elements.sidebar);
            }
            
            // If focus mode is active, disable it
            if (this.state.focusMode) {
                this.state.focusMode = false;
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.updateIntelligentFocusMode(); 
            logInfo("Sidebar toggled:", this.state.sidebarVisible ? "shown" : "hidden");
        }
        
        toggleFocusMode() {
            if (this.state.focusMode) {
                this.disableFocusMode();
            } else {
                this.enableFocusMode();
            }
        }
        
        enableFocusMode() {
            this.state.focusMode = true;
            this.state.tocVisible = false;
            this.state.sidebarVisible = false;
            
            // Hide elements
            if (this.elements.toc) {
                this.elements.toc.classList.add('hide-toc');
                this.manageFocus(this.elements.toc);
            }
            
            if (this.elements.sidebar) {
                this.elements.sidebar.classList.add('hide-sidebar');
                this.manageFocus(this.elements.sidebar);
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.announceChange("Focus mode enabled. All distractions hidden. Press Escape to exit focus mode.");
            logInfo("Focus mode enabled");
        }
        
        disableFocusMode() {
            this.state.focusMode = false;
            this.state.tocVisible = true;
            this.state.sidebarVisible = true;
            
            // Show elements
            if (this.elements.toc) {
                this.elements.toc.classList.remove('hide-toc');
            }
            
            if (this.elements.sidebar) {
                this.elements.sidebar.classList.remove('hide-sidebar');
            }
            
            this.updateGridLayout();
            this.updateButtonStates();
            this.announceChange("Focus mode disabled. All elements restored.");
            logInfo("Focus mode disabled");
        }
        
        updateGridLayout() {
            if (!this.elements.wrapper) return;
            
            // Remove all distraction-free classes
            this.elements.wrapper.classList.remove(
                'distraction-free-mode',
                'show-toc-only',
                'show-sidebar-only'
            );
            
            // Apply appropriate layout class
            if (this.state.focusMode) {
                this.elements.wrapper.classList.add('distraction-free-mode');
            } else if (!this.state.tocVisible && this.state.sidebarVisible) {
                this.elements.wrapper.classList.add('distraction-free-mode', 'show-sidebar-only');
            } else if (this.state.tocVisible && !this.state.sidebarVisible) {
                this.elements.wrapper.classList.add('distraction-free-mode', 'show-toc-only');
            }
            
            logDebug("Grid layout updated");
        }

        updateIntelligentFocusMode() {
            const contentOnlyState = !this.state.tocVisible && !this.state.sidebarVisible;
            const shouldAutoEnableFocus = contentOnlyState && !this.state.focusMode;
            
            if (shouldAutoEnableFocus) {
                logInfo("Auto-enabling focus mode - content only state detected");
                this.state.focusMode = true;
                this.updateButtonStates();
                this.updateGridLayout();
                this.announceChange("Focus mode automatically enabled - content only view");
            }
        }
        
        updateButtonStates() {
            this.updateAriaPressed(this.elements.toggleTocBtn, this.state.tocVisible);
            this.updateAriaPressed(this.elements.toggleSidebarBtn, this.state.sidebarVisible);
            this.updateAriaPressed(this.elements.focusModeBtn, this.state.focusMode);
            
            // Update TOC button text
            if (this.elements.toggleTocBtn) {
                const tocTextElement = this.elements.toggleTocBtn.querySelector('.toggle-text');
                if (tocTextElement) {
                    tocTextElement.textContent = this.state.tocVisible ? 'Hide Table of Contents' : 'Show Table of Contents';
                }
            }
            
            // Update sidebar button text
            if (this.elements.toggleSidebarBtn) {
                const sidebarTextElement = this.elements.toggleSidebarBtn.querySelector('.toggle-text');
                if (sidebarTextElement) {
                    sidebarTextElement.textContent = this.state.sidebarVisible ? 'Hide Tools & Settings' : 'Show Tools & Settings';
                }
            }
            
            // Update focus mode button text
            if (this.elements.focusModeBtn) {
                const textElement = this.elements.focusModeBtn.querySelector('.focus-mode-text');
                if (textElement) {
                    textElement.textContent = this.state.focusMode ? 'Disable Focus Mode' : 'Enable Focus Mode';
                }
            }
            
            logDebug("Button states updated");
        }
        
        updateAriaPressed(button, pressed) {
            if (button) {
                button.setAttribute('aria-pressed', pressed.toString());
            }
        }
        
        announceChange(message) {
            if (this.elements.announcements) {
                this.elements.announcements.textContent = message;
                
                // Clear announcement after 3 seconds
                setTimeout(() => {
                    if (this.elements.announcements) {
                        this.elements.announcements.textContent = '';
                    }
                }, 3000);
            }
            
            // Also use AppConfig if available
            if (window.AppConfig && typeof window.AppConfig.announceToScreenReader === 'function') {
                window.AppConfig.announceToScreenReader(message);
            }
        }
        
        manageFocus(hiddenElement) {
            // If the currently focused element is inside the hidden element, move focus
            if (document.activeElement && hiddenElement.contains(document.activeElement)) {
                if (this.elements.content) {
                    this.elements.content.focus();
                } else {
                    document.getElementById('main')?.focus() || document.body.focus();
                }
            }
        }
        
        // Public API
        getState() {
            return { ...this.state };
        }
        
        isReady() {
            return !!(this.elements.wrapper && this.elements.content);
        }
    }
    
    // Initialize when DOM is ready - ONLY when distraction-free controls exist
    function initializeDistractionFree() {
        // ✅ GUARD: Prevent initialization during export generation
        if (window.exportGenerationInProgress) {
            logDebug("Skipping DistractionFreeManager initialization - export in progress");
            return;
        }
        
        // ✅ GUARD: Only initialize if distraction-free controls exist in DOM
        if (!document.querySelector('.distraction-free-controls')) {
            logDebug("Skipping DistractionFreeManager initialization - no distraction-free controls found");
            return;
        }
        
        // ✅ GUARD: Prevent duplicate initialization
        if (window.distractionFreeManager) {
            logDebug("DistractionFreeManager already exists - skipping initialization");
            return;
        }
        
        try {
            window.distractionFreeManager = new DistractionFreeManager();
            const initialized = window.distractionFreeManager.initialize();
            
            if (initialized) {
                logInfo("✅ Distraction-free mode ready for neurodivergent users");
            } else {
                logWarn("⚠️ Distraction-free mode initialization incomplete");
            }
        } catch (error) {
            logError("Failed to initialise distraction-free mode:", error);
        }
    }

    // ✅ IMPROVED: Use more reliable initialization trigger
    if (typeof window !== 'undefined' && window.document) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initializeDistractionFree);
        } else {
            // If DOM is already ready, wait a bit for content to be fully rendered
            setTimeout(initializeDistractionFree, 100);
        }
    }
})();