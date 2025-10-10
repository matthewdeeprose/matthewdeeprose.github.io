// templates/js/mathjax-controls.js
// MathJax Controls Manager for Exported Documents
// Migrated from: export-manager.js generateMathJaxControlsJS()
// Generated with configurable accessibility level support

// MathJax Controls Manager for Exported Documents
class MathJaxControlsManager {
constructor() {
        this.currentSettings = {
            zoomTrigger: '{{zoom}}',
            zoomScale: '{{zscale}}',
            assistiveMml: {{assistiveMathML}},
            inTabOrder: {{tabNavigation}}
        };
    }

    initialize() {
        this.setupZoomTriggerControls();
        this.setupZoomScaleControl();
        this.setupScreenReaderControls();
        console.log('MathJax controls initialised with settings:', this.currentSettings);
    }

    setupZoomTriggerControls() {
        const zoomTriggerRadios = document.querySelectorAll('input[name="zoom-trigger"]');
        zoomTriggerRadios.forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.checked) {
                    this.updateZoomTrigger(event.target.value);
                }
            });
        });
    }

    setupZoomScaleControl() {
        const zoomScaleSlider = document.getElementById('zoom-scale');
        const zoomScaleValue = document.getElementById('zoom-scale-value');
        if (zoomScaleSlider && zoomScaleValue) {
            zoomScaleSlider.addEventListener('input', (event) => {
                const scalePercent = event.target.value + '%';
                zoomScaleValue.textContent = scalePercent;
                this.updateZoomScale(scalePercent);
            });
        }
    }

    setupScreenReaderControls() {
    // ❌ REMOVED: Assistive MathML handling - now managed by mathjax-manager.js
    // const assistiveMmlCheckbox = document.getElementById('assistive-mathml');
    
    const tabOrderCheckbox = document.getElementById('tab-navigation');
    
    // ❌ REMOVED: Competing assistive MathML event handler
    // This functionality is now properly handled by mathjax-manager.js
    // which includes refresh dialog logic and proper state management
    
    if (tabOrderCheckbox) {
        tabOrderCheckbox.addEventListener('change', (event) => {
            console.log('⌨️ Tab navigation checkbox changed:', event.target.checked);
            this.updateTabOrder(event.target.checked);
        });
    } else {
        console.warn('⚠️ Tab navigation checkbox not found');
    }
}

    updateZoomTrigger(trigger) {
        this.currentSettings.zoomTrigger = trigger;
        this.updateMathJaxConfig();
        this.announceToScreenReader(`Zoom trigger changed to ${trigger}`);
    }

    updateZoomScale(scale) {
        this.currentSettings.zoomScale = scale;
        this.updateMathJaxConfig();
        this.announceToScreenReader(`Zoom scale changed to ${scale}`);
    }

    updateAssistiveMml(enabled) {
        this.currentSettings.assistiveMml = enabled;
        this.updateMathJaxConfig();
        this.announceToScreenReader(`Assistive MathML ${enabled ? 'enabled' : 'disabled'}`);
    }

    updateTabOrder(enabled) {
        this.currentSettings.inTabOrder = enabled;
        console.log(`🎯 updateTabOrder called with: ${enabled}`);
        
        // Update tab order IMMEDIATELY, don't wait for async reprocessing
        this.updateMathElementTabOrderImmediate(enabled);
        
        // Still update MathJax config for consistency
        this.updateMathJaxConfig();
        this.announceToScreenReader(`Tab navigation ${enabled ? 'enabled' : 'disabled'}`);
    }

updateTabOrder(enabled) {
        this.currentSettings.inTabOrder = enabled;
        console.log(`🎯 updateTabOrder called with: ${enabled}`);
        
        // Update tab order IMMEDIATELY, don't wait for async reprocessing
        this.updateMathElementTabOrderImmediate(enabled);
        
        // Still update MathJax config for consistency
        this.updateMathJaxConfig();
        this.announceToScreenReader(`Tab navigation ${enabled ? 'enabled' : 'disabled'}`);
    }

updateMathElementTabOrderImmediate(enabled) {
        // ✅ BETTER APPROACH: Filter by parent, not CSS selector
        const allMathElements = document.querySelectorAll('mjx-container');
        const mainMathElements = Array.from(allMathElements).filter(element => {
            // Exclude if inside mjx-assistive-mml
            return !element.closest('mjx-assistive-mml');
        });
        
        console.log(`🔄 IMMEDIATE tab order update: enabled=${enabled}`);
        console.log(`   📊 Found ${allMathElements.length} total mjx-container elements`);
        console.log(`   📊 Found ${mainMathElements.length} main elements (not in assistive MathML)`);
        console.log(`   📊 Found ${allMathElements.length - mainMathElements.length} assistive elements (excluded)`);
        
        if (enabled) {
            // Enable: Add tabindex ONLY to main containers
            mainMathElements.forEach((element, index) => {
                element.setAttribute('tabindex', '0');
                if (!element.getAttribute('aria-label')) {
                    element.setAttribute('aria-label', `Mathematical expression ${index + 1}. Right-click for options.`);
                }
            });
        } else {
            // Disable: Remove tabindex from ALL mjx-containers (comprehensive cleanup)
            allMathElements.forEach(element => {
                if (element.hasAttribute('tabindex')) {
                    element.removeAttribute('tabindex');
                }
            });
            console.log(`🧹 Removed tabindex from all ${allMathElements.length} elements`);
        }
        
        // Verify the results
        const focusableMain = mainMathElements.filter(el => el.getAttribute('tabindex') === '0').length;
        const focusableAssistive = Array.from(allMathElements)
            .filter(el => el.closest('mjx-assistive-mml') && el.getAttribute('tabindex') === '0').length;
        const totalFocusable = document.querySelectorAll('mjx-container[tabindex="0"]').length;
        
        console.log(`✅ IMMEDIATE tab order results:`);
        console.log(`   📊 Main elements focusable: ${focusableMain} (should be ${enabled ? mainMathElements.length : 0})`);
        console.log(`   📊 Assistive elements focusable: ${focusableAssistive} (should always be 0)`);
        console.log(`   📊 Total focusable: ${totalFocusable} (should be ${enabled ? mainMathElements.length : 0})`);
        
        if (focusableAssistive > 0) {
            console.error(`❌ ${focusableAssistive} assistive MathML elements incorrectly have tabindex!`);
        }
        
        if (!enabled && totalFocusable > 0) {
            setTimeout(() => {
                const stillFocusable = document.querySelectorAll('mjx-container[tabindex="0"]').length;
                if (stillFocusable > 0) {
                    console.warn(`⚠️ ${stillFocusable} elements still focusable after disabling tab navigation`);
                } else {
                    console.log(`✅ Tab navigation properly disabled - no elements remain focusable`);
                }
            }, 50);
        }
    }
updateMathJaxConfig() {
        if (window.MathJax && window.MathJax.config) {
            // Approach 1: Update the startup document menu settings (primary method)
            if (window.MathJax.startup && window.MathJax.startup.document && window.MathJax.startup.document.menu) {
                const menuSettings = window.MathJax.startup.document.menu.settings;
                if (menuSettings) {
                    menuSettings.zoom = this.currentSettings.zoomTrigger;
                    menuSettings.zscale = this.currentSettings.zoomScale;
                    menuSettings.assistiveMml = this.currentSettings.assistiveMml;
                    menuSettings.inTabOrder = this.currentSettings.inTabOrder;
                    console.log('✅ MathJax menu settings updated:', menuSettings);
                }
            }

            // Approach 2: Update the config object (backup method)
            if (!window.MathJax.config.options) {
                window.MathJax.config.options = {};
            }
            if (!window.MathJax.config.options.menuOptions) {
                window.MathJax.config.options.menuOptions = {};
            }
            if (!window.MathJax.config.options.menuOptions.settings) {
                window.MathJax.config.options.menuOptions.settings = {};
            }

            const configSettings = window.MathJax.config.options.menuOptions.settings;
            configSettings.zoom = this.currentSettings.zoomTrigger;
            configSettings.zscale = this.currentSettings.zoomScale;
            configSettings.assistiveMml = this.currentSettings.assistiveMml;
            configSettings.inTabOrder = this.currentSettings.inTabOrder;

            console.log('✅ MathJax config settings updated:', configSettings);

            // Approach 3: Force MathJax to reprocess with new settings
            this.reprocessMathJax();
        }
    }

    async reprocessMathJax() {
        try {
            if (!window.MathJax || !window.MathJax.typesetPromise) {
                console.warn('MathJax reprocessing not available');
                return;
            }

            console.log('🔄 Reprocessing MathJax with new settings...');

            // Clear existing math processing
            if (window.MathJax.typesetClear) {
                window.MathJax.typesetClear();
            }

            // Wait a bit for settings to propagate
            await new Promise(resolve => setTimeout(resolve, 100));

            // Reprocess all mathematics
            await window.MathJax.typesetPromise();

            // Update tab order for existing elements if needed
            this.updateMathElementTabOrder();

            console.log('✅ MathJax reprocessing complete');
        } catch (error) {
            console.error('❌ Error reprocessing MathJax:', error);
        }
    }

updateMathElementTabOrder() {
        // This method runs after async MathJax reprocessing
        // Just ensure consistency with current settings
        console.log(`🔄 Post-reprocess tab order sync: inTabOrder=${this.currentSettings.inTabOrder}`);
        this.updateMathElementTabOrderImmediate(this.currentSettings.inTabOrder);
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('role', 'status');
        announcement.setAttribute('aria-live', 'polite');
        announcement.textContent = message;
        document.body.appendChild(announcement);
        setTimeout(() => {
            if (document.body.contains(announcement)) {
                document.body.removeChild(announcement);
            }
        }, 1000);
    }
}

{{#if explorerEnabled}}
// Initialize MathJax Explorer for enhanced accessibility (Level 2+)
if (window.MathJax && window.MathJax.startup && window.MathJax.startup.promise) {
    window.MathJax.startup.promise.then(() => {
        if (window.MathJax.config.options) {
            window.MathJax.config.options.enableExplorer = true;
            console.log('✅ MathJax Explorer enabled for enhanced accessibility');
        }
    }).catch(error => {
        console.warn('⚠️ Failed to enable MathJax Explorer:', error);
    });
} else {
    console.log('ℹ️ MathJax Explorer initialization skipped - MathJax not fully ready');
}
{{/if}}