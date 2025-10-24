// Application Settings and Default Values
class AppSettings {
    static get defaults() {
        return {
            // Canvas settings
            canvasWidth: 1000,
            canvasHeight: 600,
            canvasBackground: '#ffffff',

            // Animation settings
            frameRate: 30,
            duration: 5,

            // Text settings
            defaultFontSize: 48,
            defaultColor: '#000000',
            defaultText: 'Sample Text',

            // Timeline settings
            minPixelsPerSecond: 80,
            minTimelineWidth: 800,
            timelineHeight: 220,

            // UI settings
            maxHistorySteps: 50
        };
    }

    // Get a specific default value
    static get(key) {
        return this.defaults[key];
    }

    // Get all canvas-related defaults
    static get canvasDefaults() {
        return {
            width: this.defaults.canvasWidth,
            height: this.defaults.canvasHeight,
            background: this.defaults.canvasBackground
        };
    }

    // Get all animation-related defaults
    static get animationDefaults() {
        return {
            frameRate: this.defaults.frameRate,
            duration: this.defaults.duration
        };
    }

    // Get all text-related defaults
    static get textDefaults() {
        return {
            fontSize: this.defaults.defaultFontSize,
            color: this.defaults.defaultColor,
            text: this.defaults.defaultText
        };
    }

    // Get a setting value, fallback to default if not found
    static getValue(key) {
        try {
            const stored = localStorage.getItem(`fontanimation_${key}`);
            return stored ? JSON.parse(stored) : this.get(key);
        } catch {
            return this.get(key);
        }
    }

    // Set a setting value and persist to localStorage
    static set(key, value) {
        try {
            localStorage.setItem(`fontanimation_${key}`, JSON.stringify(value));
            return true;
        } catch {
            console.warn(`Failed to save setting: ${key}`);
            return false;
        }
    }

    // Clear all stored settings
    static clearAll() {
        try {
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith('fontanimation_')) {
                    localStorage.removeItem(key);
                }
            });
            return true;
        } catch {
            console.warn('Failed to clear settings');
            return false;
        }
    }
}

// Expose AppSettings to window object
window.AppSettings = AppSettings;