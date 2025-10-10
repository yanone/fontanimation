// Enhanced Font management with stylistic set names and better OpenType features
class FontManager {
    constructor(app) {
        this.app = app;
        this.setupFontUpload();
    }

    setupFontUpload() {
        const fontUpload = document.getElementById('fontUpload');
        fontUpload.addEventListener('change', (e) => this.handleFontUpload(e));
    }

    async handleFontUpload(event) {
        const files = Array.from(event.target.files);

        for (const file of files) {
            try {
                await this.loadFont(file);
            } catch (error) {
                console.error(`Error loading font ${file.name}:`, error);
                if (window.UIManager) {
                    window.UIManager.createNotification(`Error loading font ${file.name}: ${error.message}`, 'error');
                }
            }
        }

        this.updateFontList();
        this.updateFontSelect();

        // Check if any previously missing fonts are now available
        if (this.app.checkForResolvedMissingFonts) {
            this.app.checkForResolvedMissingFonts();
        }

        // Small delay to ensure fonts are fully ready, then trigger multiple redraws
        setTimeout(() => {
            if (this.app.redraw) {
                this.app.redraw();
                // Force additional redraws to ensure font changes are visible
                setTimeout(() => this.app.redraw(), 50);
                setTimeout(() => this.app.redraw(), 200);
            }
        }, 100);

        if (window.UIManager) {
            window.UIManager.createNotification(`Loaded ${files.length} font(s)`, 'success');
        }
    }

    async loadFont(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (e) => {
                try {
                    const arrayBuffer = e.target.result;
                    const font = opentype.parse(arrayBuffer);

                    if (!font.supported) {
                        throw new Error('Font format not supported');
                    }

                    // Get font name from name table
                    const fontFamily = this.getFontFamilyName(font);

                    // Create CSS font face
                    const fontData = new Uint8Array(arrayBuffer);
                    const fontBlob = new Blob([fontData], { type: this.getFontMimeType(file.name) });
                    const fontUrl = URL.createObjectURL(fontBlob);

                    const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
                    await fontFace.load();
                    document.fonts.add(fontFace);

                    // Wait a bit more to ensure the font is fully ready
                    await document.fonts.ready;

                    // Store font data
                    const fontInfo = {
                        name: fontFamily,
                        font: font,
                        file: file,
                        url: fontUrl,
                        variableAxes: this.extractVariableAxes(font),
                        openTypeFeatures: this.extractOpenTypeFeatures(font),
                        stylisticSets: this.extractStylisticSets(font)
                    };

                    this.app.fonts.set(fontFamily, fontInfo);
                    resolve(fontInfo);

                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => reject(new Error('Failed to read font file'));
            reader.readAsArrayBuffer(file);
        });
    }

    getFontFamilyName(font) {
        // Try to get the best font family name from the name table
        const names = font.names;

        // Preferred order: English names first
        return names.fontFamily?.en ||
            names.preferredFamily?.en ||
            names.fontFamily?.['en-US'] ||
            names.fullName?.en ||
            names.postScriptName?.en ||
            Object.values(names.fontFamily || {})[0] ||
            'Unknown Font';
    }

    getFontMimeType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        switch (ext) {
            case 'otf': return 'font/otf';
            case 'ttf': return 'font/ttf';
            case 'woff': return 'font/woff';
            case 'woff2': return 'font/woff2';
            default: return 'font/otf';
        }
    }

    extractVariableAxes(font) {
        const axes = {};

        if (font.tables.fvar && font.tables.fvar.axes) {
            font.tables.fvar.axes.forEach(axis => {
                let axisName = axis.tag;

                // Try to get a better name from the STAT table or use common names
                if (axis.name && axis.name.en) {
                    axisName = axis.name.en;
                } else {
                    axisName = this.getAxisName(axis.tag);
                }

                axes[axis.tag] = {
                    name: axisName,
                    min: axis.minValue,
                    max: axis.maxValue,
                    default: axis.defaultValue,
                    tag: axis.tag
                };
            });
        }

        return axes;
    }

    getAxisName(tag) {
        const axisNames = {
            'wght': 'Weight',
            'wdth': 'Width',
            'ital': 'Italic',
            'opsz': 'Optical Size',
            'slnt': 'Slant',
            'grad': 'Grade',
            'GRAD': 'Grade',
            'XTRA': 'X Transparent',
            'XOPQ': 'X Opaque',
            'YOPQ': 'Y Opaque',
            'YTLC': 'Y Transparent LC',
            'YTUC': 'Y Transparent UC',
            'YTAS': 'Y Transparent Ascender',
            'YTDE': 'Y Transparent Descender',
            'YTFI': 'Y Transparent Figure',
            'VOLM': 'Volume',
            'WONK': 'Wonky'
        };

        return axisNames[tag] || tag.toUpperCase();
    }

    extractOpenTypeFeatures(font) {
        const features = {};

        // Extract from GSUB table
        if (font.tables.gsub && font.tables.gsub.features) {
            font.tables.gsub.features.forEach(feature => {
                if (feature.tag && this.isDiscretionaryFeature(feature.tag)) {
                    features[feature.tag] = {
                        name: this.getFeatureName(feature.tag),
                        tag: feature.tag,
                        enabled: false,
                        description: this.getFeatureDescription(feature.tag)
                    };
                }
            });
        }

        // Extract from GPOS table
        if (font.tables.gpos && font.tables.gpos.features) {
            font.tables.gpos.features.forEach(feature => {
                if (feature.tag && this.isDiscretionaryFeature(feature.tag) && !features[feature.tag]) {
                    features[feature.tag] = {
                        name: this.getFeatureName(feature.tag),
                        tag: feature.tag,
                        enabled: false,
                        description: this.getFeatureDescription(feature.tag)
                    };
                }
            });
        }

        return features;
    }

    extractStylisticSets(font) {
        const sets = {};

        // Look for stylistic sets (ss01-ss20)
        if (font.tables.gsub && font.tables.gsub.features) {
            font.tables.gsub.features.forEach(feature => {
                if (feature.tag && feature.tag.match(/^ss\d{2}$/)) {
                    let setName = this.getStylisticSetName(font, feature.tag);

                    sets[feature.tag] = {
                        name: setName,
                        tag: feature.tag,
                        enabled: false,
                        description: `Stylistic Set ${feature.tag.slice(2)}`
                    };
                }
            });
        }

        return sets;
    }

    getStylisticSetName(font, tag) {
        // Try to get stylistic set name from the font's name table
        // This is a complex process as it involves parsing feature parameters

        // For now, use default names but this could be enhanced to read
        // the actual names from the font's feature parameters table
        const setNumber = tag.slice(2);

        // Try to find in font names (some fonts store stylistic set names)
        if (font.names && font.names.styleSet && font.names.styleSet[tag]) {
            return font.names.styleSet[tag].en || font.names.styleSet[tag];
        }

        // Default naming
        return `Stylistic Set ${parseInt(setNumber, 10)}`;
    }

    isDiscretionaryFeature(tag) {
        // Only include discretionary features that users should be able to toggle
        const discretionaryFeatures = [
            'aalt', 'calt', 'case', 'clig', 'cpsp', 'cswh', 'dlig', 'dnom', 'expt',
            'falt', 'frac', 'hist', 'hlig', 'lnum', 'numr', 'onum', 'ordn', 'pnum',
            'salt', 'sinf', 'smcp', 'ss01', 'ss02', 'ss03', 'ss04', 'ss05', 'ss06',
            'ss07', 'ss08', 'ss09', 'ss10', 'ss11', 'ss12', 'ss13', 'ss14', 'ss15',
            'ss16', 'ss17', 'ss18', 'ss19', 'ss20', 'subs', 'sups', 'swsh', 'titl',
            'tnum', 'unic', 'zero'
        ];

        return discretionaryFeatures.includes(tag);
    }

    getFeatureName(tag) {
        const featureNames = {
            'aalt': 'Access All Alternates',
            'calt': 'Contextual Alternates',
            'case': 'Case-Sensitive Forms',
            'clig': 'Contextual Ligatures',
            'cpsp': 'Capital Spacing',
            'cswh': 'Contextual Swash',
            'dlig': 'Discretionary Ligatures',
            'dnom': 'Denominators',
            'expt': 'Expert Forms',
            'falt': 'Final Glyph on Line Alternates',
            'frac': 'Fractions',
            'hist': 'Historical Forms',
            'hlig': 'Historical Ligatures',
            'lnum': 'Lining Figures',
            'numr': 'Numerators',
            'onum': 'Oldstyle Figures',
            'ordn': 'Ordinals',
            'pnum': 'Proportional Figures',
            'salt': 'Stylistic Alternates',
            'sinf': 'Scientific Inferiors',
            'smcp': 'Small Capitals',
            'ss01': 'Stylistic Set 1',
            'ss02': 'Stylistic Set 2',
            'ss03': 'Stylistic Set 3',
            'ss04': 'Stylistic Set 4',
            'ss05': 'Stylistic Set 5',
            'ss06': 'Stylistic Set 6',
            'ss07': 'Stylistic Set 7',
            'ss08': 'Stylistic Set 8',
            'ss09': 'Stylistic Set 9',
            'ss10': 'Stylistic Set 10',
            'ss11': 'Stylistic Set 11',
            'ss12': 'Stylistic Set 12',
            'ss13': 'Stylistic Set 13',
            'ss14': 'Stylistic Set 14',
            'ss15': 'Stylistic Set 15',
            'ss16': 'Stylistic Set 16',
            'ss17': 'Stylistic Set 17',
            'ss18': 'Stylistic Set 18',
            'ss19': 'Stylistic Set 19',
            'ss20': 'Stylistic Set 20',
            'subs': 'Subscript',
            'sups': 'Superscript',
            'swsh': 'Swash',
            'titl': 'Titling',
            'tnum': 'Tabular Figures',
            'unic': 'Unicase',
            'zero': 'Slashed Zero'
        };

        return featureNames[tag] || tag.toUpperCase();
    }

    getFeatureDescription(tag) {
        const descriptions = {
            'aalt': 'Access to all alternate characters',
            'calt': 'Context-sensitive alternate character forms',
            'case': 'Case-sensitive forms for punctuation',
            'clig': 'Ligatures that are optional',
            'cpsp': 'Adjust spacing between capitals',
            'cswh': 'Contextual swash alternates',
            'dlig': 'Optional ligatures for aesthetic effect',
            'dnom': 'Denominator figure forms',
            'frac': 'Diagonal fraction forms',
            'hist': 'Historical character variants',
            'hlig': 'Historical ligatures',
            'lnum': 'Figures aligned to baseline and cap height',
            'onum': 'Figures with varying heights',
            'pnum': 'Proportionally-spaced figures',
            'salt': 'Stylistic alternate forms',
            'smcp': 'Small capital forms',
            'subs': 'Subscript forms',
            'sups': 'Superscript forms',
            'swsh': 'Swash character variants',
            'titl': 'Titling character forms',
            'tnum': 'Monospaced figures',
            'zero': 'Slashed zero form'
        };

        return descriptions[tag] || '';
    }

    updateFontList() {
        const fontList = document.getElementById('fontList');
        fontList.innerHTML = '';

        this.app.fonts.forEach((fontInfo, fontName) => {
            const fontItem = document.createElement('div');
            fontItem.className = 'font-item';
            fontItem.title = fontName;

            const nameSpan = document.createElement('span');
            nameSpan.textContent = fontName.length > 10 ? fontName.substring(0, 10) + '...' : fontName;
            fontItem.appendChild(nameSpan);

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'font-delete';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = 'Delete font';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.deleteFont(fontName);
            });
            fontItem.appendChild(deleteBtn);

            fontList.appendChild(fontItem);
        });
    }

    deleteFont(fontName) {
        if (this.app.fonts.has(fontName)) {
            const fontInfo = this.app.fonts.get(fontName);

            // Revoke object URL to free memory
            if (fontInfo.url) {
                URL.revokeObjectURL(fontInfo.url);
            }

            // Remove from browser fonts
            document.fonts.forEach(font => {
                if (font.family === fontName) {
                    document.fonts.delete(font);
                }
            });

            // Remove from app
            this.app.fonts.delete(fontName);

            // Update UI
            this.updateFontList();
            this.updateFontSelect();

            // Update selected object if it was using this font
            if (this.app.selectedObject && this.app.selectedObject.fontFamily === fontName) {
                const remainingFonts = Array.from(this.app.fonts.keys());
                this.app.selectedObject.fontFamily = remainingFonts.length > 0 ? remainingFonts[0] : 'Arial';
                this.app.updateRightPanel();
                this.app.redraw();
            }

            if (window.UIManager) {
                window.UIManager.createNotification(`Removed font: ${fontName}`, 'info');
            }
        }
    }

    updateFontSelect() {
        const fontSelect = document.getElementById('fontSelect');
        const currentValue = fontSelect.value;

        fontSelect.innerHTML = '<option value="">Select a font...</option>';

        this.app.fonts.forEach((fontInfo, fontName) => {
            const option = document.createElement('option');
            option.value = fontName;
            option.textContent = fontName;
            if (fontName === currentValue) {
                option.selected = true;
            }
            fontSelect.appendChild(option);
        });
    }

    getFontFeatures(textObject) {
        if (!this.app.fonts.has(textObject.fontFamily)) {
            return { fontFeatureSettings: 'normal', fontVariationSettings: 'normal' };
        }

        const fontInfo = this.app.fonts.get(textObject.fontFamily);
        let fontFeatureSettings = '';

        // Apply OpenType features
        Object.entries(textObject.openTypeFeatures || {}).forEach(([tag, enabled]) => {
            if (enabled && fontInfo.openTypeFeatures[tag]) {
                fontFeatureSettings += `"${tag}" 1, `;
            }
        });

        // Apply stylistic sets
        Object.entries(fontInfo.stylisticSets || {}).forEach(([tag, setInfo]) => {
            if (textObject.openTypeFeatures && textObject.openTypeFeatures[tag]) {
                fontFeatureSettings += `"${tag}" 1, `;
            }
        });

        // Apply variable font axes
        let fontVariationSettings = '';
        Object.entries(textObject.variableAxes || {}).forEach(([tag, value]) => {
            if (fontInfo.variableAxes[tag]) {
                fontVariationSettings += `"${tag}" ${value}, `;
            }
        });

        // Remove trailing commas
        fontFeatureSettings = fontFeatureSettings.replace(/, $/, '') || 'normal';
        fontVariationSettings = fontVariationSettings.replace(/, $/, '') || 'normal';

        return { fontFeatureSettings, fontVariationSettings };
    }

    generateFontCSS(textObject) {
        const features = this.getFontFeatures(textObject);

        return `
            font-family: "${textObject.fontFamily}", Arial, sans-serif;
            font-feature-settings: ${features.fontFeatureSettings};
            font-variation-settings: ${features.fontVariationSettings};
        `;
    }

    // Get all available fonts (system + loaded)
    getAllAvailableFonts() {
        const fonts = Array.from(this.app.fonts.keys());
        return fonts.length > 0 ? fonts : ['Arial', 'Helvetica', 'Times New Roman', 'Courier New'];
    }
}

// Initialize font manager when app is ready
window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (window.app) {
            window.app.fontManager = new FontManager(window.app);
        }
    }, 100);
});