# Font Animation Studio - Data File Format Documentation

**Version:** 1.3  
**Last Updated:** October 24, 2025  
**File Extension:** `.json`

## Overview

Font Animation Studio saves projects as JSON files containing all project data including text objects, animations, canvas settings, and font references. This format is designed to be human-readable and version-controlled.

## File Structure

```json
{
  "version": "1.3",
  "textObjects": [...],
  "settings": {...},
  "fonts": [...]
}
```

## Root Level Properties

### `version` (string, required)
- **Description:** Format version identifier for compatibility checking
- **Current Value:** `"1.3"`
- **Usage:** Used to handle format migrations and compatibility

### `textObjects` (array, required)
- **Description:** Array of all text objects in the project
- **Type:** Array of Text Object structures
- **Default:** `[]` (empty array for new projects)

### `settings` (object, required)
- **Description:** Canvas and animation settings
- **Type:** Settings Object structure

### `fonts` (array, required)
- **Description:** List of font family names used in the project
- **Type:** Array of strings
- **Usage:** Used to detect missing fonts when loading projects

---

## Text Object Structure

Each text object represents an animated text element on the canvas.

```json
{
  "id": 1697123456789,
  "text": "Sample Text",
  "fontFamily": "Arial",
  "openTypeFeatures": {},
  "initialState": {
    "x": 100,
    "y": 150,
    "fontSize": 48,
    "color": "#000000"
  },
  "keyframes": {
    "x": [...],
    "y": [...],
    "fontSize": [...],
    "color": [...],
    "variableaxis:wght": [...],
    "wdth": [...]
  }
}
```

### Text Object Properties

#### Static Properties (never change during animation)
| Property | Type | Required | Description | Default | Range/Format |
|----------|------|----------|-------------|---------|--------------|
| `id` | number | ✅ | Unique identifier (timestamp) | `Date.now()` | Positive integer |
| `text` | string | ✅ | Text content to display | `"Sample Text"` | Any string, max ~500 chars |
| `fontFamily` | string | ✅ | Font family name | `"Arial"` | Valid font name |
| `textAlign` | string | ✅ | Text alignment | `"left"` | `"left"`, `"center"`, `"right"` |
| `openTypeFeatures` | object | ✅ | OpenType feature settings | `{}` | See OpenType Features |

#### Initial State (special keyframe before animation)
| Property | Type | Required | Description | Default | Range/Format |
|----------|------|----------|-------------|---------|--------------|
| `initialState` | object | ✅ | Default property values before keyframes | `{}` | See Initial State Object |

#### Dynamic Properties (stored in keyframes)
| Property | Type | Required | Description | Default | Range/Format |
|----------|------|----------|-------------|---------|--------------|
| `keyframes` | object | ✅ | Property-specific keyframe arrays | `{}` | See Keyframes Object |

### Keyframes Object Structure

Dynamic properties are organized by property name, each containing an array of keyframes:

```json
{
  "x": [
    { "frame": 0, "value": 100, "curve": {...} },
    { "frame": 60, "value": 400, "curve": {...} }
  ],
  "y": [
    { "frame": 0, "value": 150 },
    { "frame": 60, "value": 300 }
  ],
  "fontSize": [
    { "frame": 30, "value": 72 }
  ],
  "variableaxis:wght": [
    { "frame": 0, "value": 400 },
    { "frame": 90, "value": 900 }
  ]
}
```

### Initial State Object

The `initialState` object contains the default values for all animatable properties before any keyframes are created. This allows users to freely modify object properties without automatically creating keyframes, improving the editing experience.

```json
{
  "initialState": {
    "x": 100,
    "y": 150,
    "fontSize": 48,
    "color": "#000000",
    "textColor": "#000000",
    "variableaxis:wght": 400,
    "variableaxis:wdth": 100
  }
}
```

**Key Characteristics:**
- **Pre-keyframe state**: Values used when no keyframes exist for a property
- **Freely editable**: Can be modified unlimited times without creating keyframes
- **Per-property**: Each animatable property can have an initial value
- **Optional entries**: Only properties that have been set need to be included
- **Falls back to defaults**: Missing properties use application defaults

**Behavior:**
1. When an object is created, property changes update `initialState`
2. No keyframes are created until the user explicitly adds them
3. Once a property has keyframes, `initialState` for that property is no longer used
4. Users can reset to initial state by removing all keyframes for a property

### Variable Font Axes

Variable font axes are now stored as individual keyframe arrays within the keyframes object. Each axis becomes its own animatable property:

```json
{
  "keyframes": {
    "variableaxis:wght": [
      { "frame": 0, "value": 400 },
      { "frame": 60, "value": 900 }
    ],
    "variableaxis:wdth": [
      { "frame": 30, "value": 75 },
      { "frame": 90, "value": 125 }
    ]
  }
}
```

- **Key:** Variable axis property name with `variableaxis:` prefix (e.g., `"variableaxis:wght"`, `"variableaxis:wdth"`, `"variableaxis:opsz"`)
- **Value:** Array of keyframe objects with frame/value pairs

### OpenType Features Structure

Stores enabled OpenType features:

```json
{
  "liga": true,
  "kern": true,
  "ss01": false,
  "smcp": true
}
```

- **Key:** 4-character feature tag (e.g., `"liga"`, `"kern"`, `"ss01"`)
- **Value:** Boolean (true = enabled, false = disabled)

---

## Keyframe Structure

Individual keyframes define a single property value at a specific timeline position.

```json
{
  "frame": 60,
  "value": 400,
  "curve": {
    "x1": 0.25,
    "y1": 0.1,
    "x2": 0.25,
    "y2": 1.0
  }
}
```

### Keyframe Properties

| Property | Type | Required | Description | Default |
|----------|------|----------|-------------|---------|
| `frame` | number | ✅ | Timeline frame number | `0` |
| `value` | any | ✅ | Property value at this frame | Property-dependent |
| `curve` | object | ❌ | Bezier curve for interpolation | Linear interpolation |

### Animatable Properties

| Property | Type | Description | Range |
|----------|------|-------------|-------|
| `x` | number | Horizontal position | Any number |
| `y` | number | Vertical position | Any number |
| `fontSize` | number | Font size in pixels | 1-200 |
| `color` | string | Text color | Hex color code |
| `variableaxis:{axis}` | number | Variable font axis (e.g., `variableaxis:wght`, `variableaxis:wdth`) | Font-specific ranges |

### Bezier Curve Object

Defines easing curve for animation interpolation:

| Property | Type | Description | Range |
|----------|------|-------------|-------|
| `x1` | number | First control point X | 0.0-1.0 |
| `y1` | number | First control point Y | 0.0-1.0 |
| `x2` | number | Second control point X | 0.0-1.0 |
| `y2` | number | Second control point Y | 0.0-1.0 |

---

## Settings Object Structure

Contains canvas and animation settings:

```json
{
  "canvasWidth": 1920,
  "canvasHeight": 1080,
  "canvasBackground": "#ffffff",
  "frameRate": 30,
  "duration": 5.0
}
```

### Settings Properties

| Property | Type | Required | Description | Default | Range |
|----------|------|----------|-------------|---------|-------|
| `canvasWidth` | number | ✅ | Canvas width in pixels | `1920` | 100-8000 |
| `canvasHeight` | number | ✅ | Canvas height in pixels | `1080` | 100-8000 |
| `canvasBackground` | string | ✅ | Canvas background color | `"#ffffff"` | Hex color code |
| `frameRate` | number | ✅ | Animation frame rate (fps) | `30` | 1-120 |
| `duration` | number | ✅ | Total duration in seconds | `5.0` | 0.1-300.0 |

---

## Example Complete File

```json
{
  "version": "1.3",
  "textObjects": [
    {
      "id": 1697123456789,
      "text": "Hello World",
      "fontFamily": "Inter",
      "openTypeFeatures": {
        "liga": true,
        "kern": true
      },
      "initialState": {
        "x": 100,
        "y": 100,
        "fontSize": 48,
        "color": "#ff0000",
        "textColor": "#ff0000",
        "variableaxis:wght": 600
      },
      "keyframes": {
        "x": [
          { "frame": 0, "value": 100 },
          { 
            "frame": 150, 
            "value": 500,
            "curve": {
              "x1": 0.25,
              "y1": 0.1,
              "x2": 0.25,
              "y2": 1.0
            }
          }
        ],
        "y": [
          { "frame": 0, "value": 100 },
          { "frame": 150, "value": 300 }
        ],
        "fontSize": [
          { "frame": 0, "value": 48 },
          { "frame": 150, "value": 72 }
        ],
        "color": [
          { "frame": 0, "value": "#ff0000" },
          { "frame": 150, "value": "#0000ff" }
        ],
        "variableaxis:wght": [
          { "frame": 0, "value": 600 },
          { "frame": 150, "value": 900 }
        ]
      }
    }
  ],
  "settings": {
    "canvasWidth": 1920,
    "canvasHeight": 1080,
    "canvasBackground": "#ffffff",
    "frameRate": 30,
    "duration": 5.0
  },
  "fonts": [
    "Inter",
    "Arial"
  ]
}
```

---

## Loading Behavior

### Missing Fonts
When a project is loaded with fonts that aren't available in the system:
1. A warning modal displays missing font names
2. User can choose to continue anyway
3. Missing fonts fall back to system defaults (usually Arial)
4. Font references remain in the data for when fonts become available

### Version Compatibility
- Files without a `version` field are treated as version 1.0
- Future versions will include migration logic
- Backwards compatibility is maintained when possible

### Error Handling
- Invalid JSON shows error notification
- Missing required fields use default values
- Invalid property values are clamped to valid ranges
- Malformed keyframes are skipped with warnings

---

## Implementation Notes

### Property Updates
When properties are changed via UI:
1. Direct object properties are updated
2. Current frame keyframe is updated/created
3. Changes are reflected immediately in rendering

### Animation Interpolation
- Linear interpolation is used when no curve is specified
- Bezier curves use standard cubic-bezier interpolation
- Properties interpolate independently

### Data Validation
Properties are validated on load:
- Numbers are clamped to valid ranges
- Colors default to black if invalid
- Missing required fields use defaults
- Arrays/objects are initialized if missing

---

## Version History

### Version 1.3 (October 24, 2025)
- Added `initialState` object to text objects
- Improved user experience by separating initial property values from keyframes
- Properties can now be modified freely before creating keyframes
- Keyframes no longer created automatically on property changes

### Version 1.2 (October 12, 2025)
- **BREAKING CHANGE:** Complete keyframe system overhaul
- Separated static properties (text, fontFamily, openTypeFeatures) from dynamic properties
- Dynamic properties now stored as property-specific keyframe arrays
- Individual keyframes now contain single values instead of property bundles
- Variable font axes moved from nested objects to individual keyframe arrays
- Simplified interpolation with per-keyframe curve definitions

### Version 1.1 (October 10, 2025)
- **BREAKING CHANGE:** Removed `rotation` property from text objects
- Simplified text object structure
- Updated keyframe properties structure

### Version 1.0 (October 10, 2025)
- Initial format specification
- Basic text objects with keyframe animation
- Canvas settings and font references
- Variable font and OpenType feature support

---

## Future Considerations

Planned additions for future versions:
- Layer system for z-ordering
- Text effects and filters
- Audio synchronization markers
- Advanced curve types
- Template and preset support
- Asset embedding (font files)

---

*This documentation should be updated whenever the file format changes. Maintain backwards compatibility when possible and provide migration paths for breaking changes.*