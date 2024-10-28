/**
 * @fileoverview Mathematical Utility Class
 * 
 * This class provides utility functions for mathematical operations used in the
 * color combination system. It includes:
 * - Combination calculations (nCr)
 * - Random selection from arrays
 * 
 * These utilities are crucial for:
 * - Calculating total possible color combinations
 * - Selecting random color sets
 * - Ensuring unique color selections
 */

export class MathUtils {
    /**
     * Calculates the number of possible combinations (nCr)
     * Uses the combination formula: n!/(r!(n-r)!)
     * Implemented iteratively to avoid factorial overflow
     * 
     * @param {number} n Total number of items to choose from
     * @param {number} r Number of items being chosen
     * @returns {number} Number of possible combinations
     * 
     * @example
     * // Returns 10 (ways to choose 2 items from 5)
     * MathUtils.calculateCombinations(5, 2)
     * 
     * @example
     * // Returns 1 (only one way to choose all items)
     * MathUtils.calculateCombinations(5, 5)
     * 
     * @example
     * // Returns 0 (can't choose more items than available)
     * MathUtils.calculateCombinations(5, 6)
     */
    static calculateCombinations(n, r) {
        // Check if we're trying to choose more items than available
        if (r > n) return 0;

        // Initialize result
        let result = 1;

        // Calculate combination using the multiplicative formula
        // This approach avoids calculating large factorials
        for (let i = 1; i <= r; i++) {
            result *= (n - r + i) / i;
        }

        // Return floor of result to handle floating point precision issues
        return Math.floor(result);
    }

    /**
     * Selects n random unique elements from an array
     * Uses an efficient algorithm to avoid duplicate selections
     * 
     * @param {Array} arr Source array to select from
     * @param {number} n Number of elements to select
     * @returns {Array} Array of n randomly selected elements
     * @throws {RangeError} If trying to select more elements than available
     * 
     * @example
     * // Returns array of 2 random colors
     * MathUtils.getRandom(['#FF0000', '#00FF00', '#0000FF'], 2)
     * 
     * @example
     * // Throws RangeError
     * MathUtils.getRandom(['#FF0000'], 2)
     */
    static getRandom(arr, n) {
        // Initialize result array with exact size needed
        const result = new Array(n);
        
        // Use Set for O(1) lookup of used indices
        const taken = new Set();
        
        // Store array length for efficiency
        const len = arr.length;

        // Validate input
        if (n > len) {
            throw new RangeError(
                `Cannot select ${n} elements from array of length ${len}. ` +
                `Number of elements to select must not exceed array length.`
            );
        }

        // Select random elements until we have enough
        while (taken.size < n) {
            // Generate random index
            const x = Math.floor(Math.random() * len);
            
            // If we haven't used this index yet
            if (!taken.has(x)) {
                // Add index to taken set
                taken.add(x);
                // Add corresponding element to result
                // taken.size - 1 gives us the current insertion position
                result[taken.size - 1] = arr[x];
            }
        }

        return result;
    }

    /**
     * Suggested Addition: Fisher-Yates shuffle algorithm
     * Useful for randomizing entire arrays
     * 
     * @param {Array} array Array to shuffle
     * @returns {Array} New shuffled array
     */
    static shuffle(array) {
        // Create copy of array to avoid modifying original
        const shuffled = [...array];
        
        // Shuffle using Fisher-Yates algorithm
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled;
    }

    /**
     * Suggested Addition: Generate sequence of numbers
     * Useful for creating ranges of values
     * 
     * @param {number} start Start of range (inclusive)
     * @param {number} end End of range (exclusive)
     * @param {number} step Step size (default: 1)
     * @returns {Array<number>} Array of numbers in range
     */
    static range(start, end, step = 1) {
        const length = Math.ceil((end - start) / step);
        return Array.from({ length }, (_, i) => start + i * step);
    }

    /**
     * Suggested Addition: Calculate permutations
     * Useful when order matters in selections
     * 
     * @param {number} n Total number of items
     * @param {number} r Number of items to arrange
     * @returns {number} Number of possible permutations
     */
    static calculatePermutations(n, r) {
        if (r > n) return 0;
        let result = 1;
        for (let i = 0; i < r; i++) {
            result *= (n - i);
        }
        return result;
    }
}