// /app.js
import { ColorChecker } from './colorChecker.js';

console.log('App.js is loading...');

let colorChecker; // Make this global to the module

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded...');
    try {
        colorChecker = new ColorChecker();
        await colorChecker.init();
        
        // Add randomize button listener here instead of separate method
        const randomizeBtn = document.getElementById('randomizeBtn');
        if (randomizeBtn) {
            randomizeBtn.addEventListener('click', () => {
                try {
                    colorChecker.randomAll();
                } catch (error) {
                    console.error('Randomize error:', error);
                    colorChecker.uiManager.displayError(error.message);
                }
            });
        }
        
        console.log('ColorChecker initialized successfully');
    } catch (error) {
        console.error('Failed to initialize ColorChecker:', error);
    }
});