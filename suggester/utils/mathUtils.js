export class MathUtils {
    static calculateCombinations(n, r) {
        if (r > n) return 0;
        let result = 1;
        for (let i = 1; i <= r; i++) {
            result *= (n - r + i) / i;
        }
        return Math.floor(result);
    }

    static getRandom(arr, n) {
        const result = new Array(n);
        const taken = new Set();
        const len = arr.length;

        if (n > len) {
            throw new RangeError("getRandom: more elements taken than available");
        }

        while (taken.size < n) {
            const x = Math.floor(Math.random() * len);
            if (!taken.has(x)) {
                taken.add(x);
                result[taken.size - 1] = arr[x];
            }
        }

        return result;
    }
}