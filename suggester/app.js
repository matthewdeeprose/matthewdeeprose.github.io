import { ColorChecker } from './colorChecker.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const colorChecker = new ColorChecker();
        await colorChecker.init();
    } catch (error) {
        console.error('Failed to initialize ColorChecker:', error);
    }
});