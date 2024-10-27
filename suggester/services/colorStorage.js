export class ColorStorage {
    constructor() {
        this.colors = [];
        this.validColorSets = new Map();
    }

    loadColors(colors) {
        this.colors = colors;
        return this.preValidateColorCombinations();
    }

    getColorName(colour) {
        const colorObj = this.colors.find(x => x.colourHex === colour);
        return colorObj ? colorObj.name : "Unknown color";
    }
}
