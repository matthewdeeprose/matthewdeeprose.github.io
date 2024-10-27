
import { ColorChecker } from './colorChecker.js';

console.log('App.js is loading...');

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded...');
    try {
        const colorChecker = new ColorChecker();
        await colorChecker.init();
        colorChecker.initRandomizeButton();
        console.log('ColorChecker initialized successfully');
    } catch (error) {
        console.error('Failed to initialize ColorChecker:', error);
    }
});