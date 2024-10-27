export class ColorValidator {
  static validateHex(hex) {
    hex = hex.replace(/\s/g, '');
    if (!hex.startsWith('#')) {
      hex = '#' + hex;
    }
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      throw new Error(`Invalid hex color: ${hex}`);
    }
    return hex.toUpperCase();
  }

  static isHexColor(str) {
    str = str.replace(/\s/g, '');
    if (!str.startsWith('#')) {
      str = '#' + str;
    }
    return /^#[0-9A-Fa-f]{6}$/.test(str);
  }

  static validateColorJson(jsonData) {
    if (!Array.isArray(jsonData)) {
      throw new Error('Color data must be an array');
    }

    const requiredFields = ['colourHex', 'name'];
    jsonData.forEach((color, index) => {
      requiredFields.forEach(field => {
        if (!(field in color)) {
          throw new Error(`Missing required field '${field}' in color at index ${index}`);
        }
      });

      this.validateHex(color.colourHex);

      if (!color.name.trim()) {
        throw new Error(`Empty color name at index ${index}`);
      }
    });

    return true;
  }
}