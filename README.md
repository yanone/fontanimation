# Font Animation Studio

A web-based typography animation tool for creating variable font animations with OpenType feature control.

## 🚀 Live Demo

**Try the app live at**: [https://yanone.github.io/fontanimation](https://yanone.github.io/fontanimation)

## Why This App Exists

Most video editors don't expose variable font settings and OpenType features to users, making it impossible to create sophisticated typography animations directly within video editing software. This tool fills that gap by providing a dedicated environment for creating text animations that leverage the full power of modern typography and render them into a video file to be used in video editing.

Since videos don’t support alpha channels, you would choose a certain background color and make that disappear in video production.

## What It Does

Font Animation Studio allows you to:

- **Animate Variable Fonts**: Create smooth transitions between different font variations (weight, width, slant, optical size, etc.)
- **Control OpenType Features**: Toggle and animate advanced typography features like ligatures, alternates, small caps, and more
- **Timeline-Based Animation**: Use a professional timeline interface with keyframes for precise animation control
- **Export for Video**: Generate animations that can be imported into video editing software
- **Real-Time Preview**: See your animations in real-time with an interactive canvas

## Key Features

### Typography Control
- Support for variable fonts with all available axes
- Full OpenType feature support (ligatures, alternates, swashes, etc.)
- Real-time font rendering with high-DPI support
- Custom text input and styling

### Animation Tools
- Keyframe-based animation system
- Bezier curve interpolation for smooth transitions
- Timeline scrubbing and playback controls
- Frame-by-frame navigation

### Professional Interface
- Modern, dark-themed UI optimized for creative work
- Material Design icons and components
- Responsive layout for different screen sizes
- Keyboard shortcuts for efficient workflow

### Export Capabilities
- High-quality animation export
- Multiple format support
- Customizable canvas dimensions and frame rates

## Getting Started

1. Open the app in a modern web browser
2. Upload your variable font files using the upload button
3. Create text objects on the canvas using the Text Tool
4. Adjust typography settings and OpenType features
5. Set keyframes on the timeline to create animations
6. Export your animation for use in video projects

## ⌨️ Keyboard Shortcuts

### Playback
| Shortcut | Action |
|----------|--------|
| `Enter` | Play/Pause animation |
| `←/→` | Navigate frame by frame |
| `Shift+←/→` | Jump 10 frames |
| `Cmd+←/→` | Jump to first/last frame |

### Tools
| Shortcut | Action |
|----------|--------|
| `Space` | Hand tool (temporary) |
| `H` | Hand tool |
| `T` | Text tool |
| `V` | Select tool |
| `Z` | Zoom tool |

### Objects
| Shortcut | Action |
|----------|--------|
| `Cmd+D` | Duplicate selected object |
| `Alt+Drag` | Duplicate while moving |
| `Delete` | Delete selected object |

### View
| Shortcut | Action |
|----------|--------|
| `Cmd+Plus` | Zoom in |
| `Cmd+Minus` | Zoom out |
| `Cmd+0` | Reset zoom to 100% |

### General
| Shortcut | Action |
|----------|--------|
| `Cmd+E` | Export video |
| `Cmd+Z` | Undo |
| `Cmd+Shift+Z` | Redo |
| `Escape` | Close modals |

## Browser Requirements

- Modern web browser with support for:
  - Variable fonts
  - Canvas API
  - ES6+ JavaScript features
  - CSS Grid and Flexbox

## 🛠 Development

To run this locally:
```bash
git clone https://github.com/yanone/fontanimation.git
cd fontanimation
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

> **Note**: Files must be served over HTTP (not file://) due to browser security requirements for font loading and export features.

## Technical Details

Built with vanilla JavaScript, HTML5 Canvas, and modern CSS. No external dependencies required - runs entirely in the browser for maximum compatibility and performance.

---

*Created to bridge the gap between advanced typography and video production workflows.*