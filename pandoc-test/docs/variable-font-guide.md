# Adding Variable Fonts - Simplified Implementation Guide
## Enhanced Pandoc-WASM Mathematical Playground

### 🎯 **Variable Fonts: Much More Efficient!**

Variable fonts are a modern web font technology where **one file contains all weight/style variations**. This is significantly more efficient than the 4-file approach used for OpenDyslexic.

### ✅ **Advantages of Variable Fonts**
- **Single file** instead of 4 separate files (75% size reduction!)
- **Smoother weight transitions** (any weight from 100-900, not just Regular/Bold)
- **Better performance** (one network request, one base64 string)
- **More design flexibility** (custom weight values like 450, 650, etc.)

---

## 📁 **Step 1: Variable Font Preparation**

### **1.1 Verify Variable Font Capabilities**
Check what variations your font supports:

**Using online tools:**
- [Wakamaifondue](https://wakamaifondue.com/) - Upload your font to see available axes
- [Variable Fonts](https://v-fonts.com/) - Browse variable font examples

**Common variable font axes:**
- `wght` (Weight): 100-900 (Thin to Black)
- `ital` (Italic): 0-1 (Roman to Italic)
- `slnt` (Slant): -15 to 0 (Italic slant angle)
- `wdth` (Width): 75-125 (Condensed to Extended)

### **1.2 Convert to Base64**
Since you only have **one file**, this is much simpler:

**Windows (PowerShell):**
```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("YourFont-Variable.woff2")) > fontname-variable.txt
```

**macOS/Linux (Terminal):**
```bash
base64 -i YourFont-Variable.woff2 > fontname-variable.txt
```

---

## 📂 **Step 2: Simplified File Structure**

### **2.1 Create Single Font Data File**
Add just **one file** to the `fonts/` directory:

```
📁 fonts/
├── 📄 opendyslexic-regular.txt (existing - 4 files for static font)
├── 📄 opendyslexic-bold.txt
├── 📄 opendyslexic-italic.txt
├── 📄 opendyslexic-bold-italic.txt
└── 📄 fontname-variable.txt ✅ SINGLE FILE!
```

---

## 🔧 **Step 3: Update Template System (Simplified)**

### **3.1 Add Variable Font to Font Loading**

**File to Update:** `js/export/template-system.js`

**FIND the `loadFontData` function and ADD your variable font:**

```javascript
    async loadFontData(overrideFontData = {}) {
      // ... existing logging setup ...

      // Font file mapping - MUCH SIMPLER for variable fonts!
      const fontFiles = {
        // Existing OpenDyslexic (static font - 4 files)
        regular: 'fonts/opendyslexic-regular.txt',
        bold: 'fonts/opendyslexic-bold.txt',
        italic: 'fonts/opendyslexic-italic.txt',
        boldItalic: 'fonts/opendyslexic-bold-italic.txt',
        
        // ✅ VARIABLE FONT - SINGLE FILE!
        fontNameVariable: 'fonts/fontname-variable.txt'
      };

      const fontData = {};

      // Load each font file (variable fonts need only one loop iteration!)
      for (const [variant, filepath] of Object.entries(fontFiles)) {
        try {
          // Use override data if provided
          if (overrideFontData[variant]) {
            fontData[`base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`] = overrideFontData[variant];
            logDebug(`✅ Using provided font data for ${variant}`);
            continue;
          }

          // Load from external file
          logDebug(`🔄 Loading font file: ${filepath}`);
          const response = await fetch(filepath);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const base64Data = (await response.text()).trim();
          fontData[`base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`] = base64Data;
          
          logDebug(`✅ Loaded ${variant} font (${base64Data.length} chars)`);
          
        } catch (error) {
          logWarn(`⚠️ Failed to load ${variant} font from ${filepath}:`, error.message);
          // Fallback to placeholder
          fontData[`base64${variant.charAt(0).toUpperCase() + variant.slice(1)}`] = "YOUR_BASE64_PLACEHOLDER";
        }
      }

      logInfo(`🎨 Font data loading complete: ${Object.keys(fontData).length} variants loaded`);
      return fontData;
    }
```

### **3.2 Update CSS Generation Method**

**FIND the `generateEmbeddedFontsCSS` method and ADD variable font support:**

```javascript
    async generateEmbeddedFontsCSS(fontData = {}) {
      // ... existing logging setup ...

      try {
        // Check if template is available
        if (!this.engine.templates.has("embedded-fonts")) {
          logWarn("⚠️ Embedded fonts template not found - graceful degradation");
          return "";
        }

        // Load font data from external files or use provided data
        const resolvedFontData = await this.loadFontData(fontData);

        // Map both static and variable fonts for template
        const templateData = {
          // OpenDyslexic (existing static font - 4 declarations)
          base64Regular: resolvedFontData.base64Regular,
          base64Bold: resolvedFontData.base64Bold,
          base64Italic: resolvedFontData.base64Italic,
          base64BoldItalic: resolvedFontData.base64BoldItalic,
          
          // ✅ VARIABLE FONT (single declaration!)
          fontNameVariableBase64: resolvedFontData.base64FontNameVariable,
          
          // ✅ FONT METADATA for template logic
          hasFontNameVariable: !!resolvedFontData.base64FontNameVariable
        };

        // Render template with all font data
        const css = this.engine.render("embedded-fonts", templateData);

        logDebug("✅ Embedded fonts CSS generated successfully");
        return css;
      } catch (error) {
        logError("❌ Failed to generate embedded fonts CSS:", error.message);
        return "";
      }
    }
```

---

## 📝 **Step 4: Update Font Template (Much Simpler!)**

### **4.1 Add Variable Font CSS to Template**

**File to Update:** `templates/embedded-fonts.html`

**ADD your variable font declaration (just ONE @font-face instead of 4!):**

```html
<!-- OpenDyslexic Font Family - Static Font (4 declarations) -->
<style>
  @font-face {
    font-family: "OpenDyslexic";
    src: url("data:font/woff2;base64,{{base64Regular}}") format("woff2");
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "OpenDyslexic";
    src: url("data:font/woff2;base64,{{base64Bold}}") format("woff2");
    font-weight: bold;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "OpenDyslexic";
    src: url("data:font/woff2;base64,{{base64Italic}}") format("woff2");
    font-weight: normal;
    font-style: italic;
    font-display: swap;
  }

  @font-face {
    font-family: "OpenDyslexic";
    src: url("data:font/woff2;base64,{{base64BoldItalic}}") format("woff2");
    font-weight: bold;
    font-style: italic;
    font-display: swap;
  }

  {{#if hasFontNameVariable}}
  <!-- ✅ VARIABLE FONT - SINGLE DECLARATION! -->
  @font-face {
    font-family: "YourFontName";
    src: url("data:font/woff2;base64,{{fontNameVariableBase64}}") format("woff2-variations");
    font-weight: 100 900; /* Full weight range */
    font-style: normal italic; /* Both normal and italic */
    font-display: swap;
    font-variation-settings: normal; /* Allow all variations */
  }
  {{/if}}
</style>
```

**Key differences for variable fonts:**
- `format("woff2-variations")` instead of `format("woff2")`
- `font-weight: 100 900` (range instead of single value)
- `font-style: normal italic` (both styles in one declaration)
- `font-variation-settings: normal` (enables all axes)

---

## 🎛️ **Step 5: Enhanced Font Selection with Variable Features**

### **5.1 Add Advanced Font Option**

**File to Update:** `js/export/template-system.js`

**ADD your variable font with advanced options:**

```javascript
    getDefaultTemplateData(templateName) {
      const defaults = {
        readingToolsSection: {
          fontOptions: [
            {
              value: "Verdana, sans-serif",
              label: "Verdana (sans-serif)",
              selected: true,
            },
            {
              value: "Arial, sans-serif",
              label: "Arial (sans-serif)",
              selected: false,
            },
            {
              value: "OpenDyslexic, sans-serif",
              label: "OpenDyslexic (dyslexia-friendly)",
              selected: false,
            },
            // ✅ VARIABLE FONT with weight options
            {
              value: "YourFontName, sans-serif",
              label: "Your Font Name (variable weight)",
              selected: false,
              isVariable: true, // ✅ Flag for advanced features
              weightRange: "100-900",
              supportsItalic: true
            },
            {
              value: "'Times New Roman', serif",
              label: "Times New Roman (serif)",
              selected: false,
            },
          ],
          
          // ✅ ADD: Variable font weight options
          variableFontWeights: [
            { value: "300", label: "Light" },
            { value: "400", label: "Regular" },
            { value: "500", label: "Medium" },
            { value: "600", label: "Semi-Bold" },
            { value: "700", label: "Bold" },
            { value: "800", label: "Extra Bold" }
          ],
          
          // ... rest of defaults
        }
      };
      return defaults[templateName] || {};
    }
```

### **5.2 Optional: Add Weight Selection UI**

You could enhance the reading tools template to include weight selection for variable fonts:

```html
<!-- In reading-tools-section.html template -->
<div class="font-controls">
  <label for="font-family-select">Font Family:</label>
  <select id="font-family-select">
    {{#each fontOptions}}
    <option value="{{value}}" {{#if selected}}selected{{/if}} data-variable="{{isVariable}}">
      {{label}}
    </option>
    {{/each}}
  </select>
  
  <!-- ✅ VARIABLE FONT WEIGHT CONTROL -->
  <div id="variable-weight-control" style="display: none;">
    <label for="font-weight-select">Font Weight:</label>
    <select id="font-weight-select">
      {{#each variableFontWeights}}
      <option value="{{value}}">{{label}}</option>
      {{/each}}
    </select>
  </div>
</div>
```

---

## 🧪 **Step 6: Testing Variable Fonts**

### **6.1 Basic Functionality Tests**

```javascript
// Test variable font loading
const generator = window.TemplateSystem.createGenerator();
const result = await generator.generateEmbeddedFontsCSS();
console.log("CSS includes variable font:", result.includes("woff2-variations"));
console.log("CSS includes weight range:", result.includes("100 900"));

// Test file size comparison
console.log("Total CSS length:", result.length);
// Should be smaller than equivalent 4-file static font
```

### **6.2 Variable Font Feature Tests**

```javascript
// Test different weights
document.body.style.fontFamily = "YourFontName, sans-serif";
document.body.style.fontWeight = "300"; // Light
setTimeout(() => {
  document.body.style.fontWeight = "700"; // Bold
}, 2000);
setTimeout(() => {
  document.body.style.fontWeight = "450"; // Custom weight!
}, 4000);

// Test italic
setTimeout(() => {
  document.body.style.fontStyle = "italic";
}, 6000);

// Reset
setTimeout(() => {
  document.body.style.fontFamily = "";
  document.body.style.fontWeight = "";
  document.body.style.fontStyle = "";
}, 8000);
```

### **6.3 Advanced Variable Font Testing**

```javascript
// Test CSS font-variation-settings (if your font has custom axes)
document.body.style.fontVariationSettings = '"wght" 350, "slnt" -5';

// Test font feature detection
if (CSS.supports('font-variation-settings', '"wght" 400')) {
  console.log("✅ Variable fonts supported");
} else {
  console.log("❌ Variable fonts not supported");
}
```

---

## 📊 **Performance Benefits**

### **File Size Comparison:**

**Static Font (4 files):**
```
Regular.woff2:  ~150KB → ~200KB base64
Bold.woff2:     ~160KB → ~213KB base64  
Italic.woff2:   ~155KB → ~207KB base64
BoldItalic.woff2: ~165KB → ~220KB base64
Total: ~630KB → ~840KB base64
```

**Variable Font (1 file):**
```
Variable.woff2: ~200KB → ~267KB base64
Total: ~200KB → ~267KB base64
```

**🎯 Result: ~68% size reduction!**

### **Performance Advantages:**
- **Fewer network requests** (1 instead of 4)
- **Smaller total file size** (typically 50-70% smaller)
- **Better caching** (one font file cached instead of 4)
- **Smoother animations** (weight transitions)
- **More design flexibility** (any weight from 100-900)

---

## 🎯 **Variable Font CSS Examples**

### **Using Standard Properties:**
```css
.light-text {
  font-family: "YourFontName", sans-serif;
  font-weight: 300; /* Light */
}

.custom-weight {
  font-family: "YourFontName", sans-serif;
  font-weight: 450; /* Custom weight - not possible with static fonts! */
}

.italic-medium {
  font-family: "YourFontName", sans-serif;
  font-weight: 500;
  font-style: italic;
}
```

### **Using Font Variation Settings (Advanced):**
```css
.custom-variation {
  font-family: "YourFontName", sans-serif;
  font-variation-settings: 
    "wght" 350,  /* Weight */
    "slnt" -8;   /* Slant (if supported) */
}
```

---

## 🔄 **Migration from Static to Variable**

If you want to **replace an existing static font** with its variable version:

### **1. Replace Font Files:**
```
❌ Remove:
fonts/fontname-regular.txt
fonts/fontname-bold.txt  
fonts/fontname-italic.txt
fonts/fontname-bold-italic.txt

✅ Add:
fonts/fontname-variable.txt
```

### **2. Update Template:**
Replace 4 @font-face declarations with 1 variable declaration

### **3. Maintain Backward Compatibility:**
The font-family name stays the same, so existing CSS continues to work!

---

## 📋 **Quick Variable Font Checklist**

### **For Each Variable Font:**
- [ ] **1 file** instead of 4 (fontname-variable.txt)
- [ ] **1 font mapping** in loadFontData()
- [ ] **1 template variable** in generateEmbeddedFontsCSS()
- [ ] **1 @font-face** declaration with weight/style ranges
- [ ] **Enhanced font option** with isVariable flag
- [ ] Test weight range (100-900) and italic support
- [ ] Verify 60-70% size reduction vs static equivalent

### **Template Changes:**
```html
<!-- Instead of 4 declarations: -->
@font-face {
  font-family: "FontName";
  src: url("data:font/woff2;base64,{{variableBase64}}") format("woff2-variations");
  font-weight: 100 900;
  font-style: normal italic;
  font-display: swap;
}
```

---

## 🚀 **Recommended Variable Fonts**

### **Popular Variable Fonts for Accessibility:**
- **Inter** - Excellent readability, full weight range
- **Source Sans Variable** - Adobe's versatile sans-serif
- **Work Sans** - Optimized for screen reading
- **Crimson Pro** - Variable serif for body text
- **JetBrains Mono Variable** - For code/mathematical content

### **Where to Find Variable Fonts:**
- [Google Fonts](https://fonts.google.com/?vfonly=true) (filter for Variable fonts)
- [Variable Fonts](https://v-fonts.com/)
- [Axis-Praxis](https://axis-praxis.org/)

Variable fonts represent the future of web typography and are **much more efficient** for your accessibility-focused system! 🎯