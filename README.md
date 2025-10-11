# Font Animation Studio

A web-based typography animation tool for creating variable font animations with OpenType feature control.

## Development Stage

Development is in pre-alpha stage. Random things might not be working.

## Run Quickly For Testing:

In order to run this locally on your computer, check out the repo and then run `python3 -m http.server 8000` so that files other than `index.html` can get served over a "network connection", which is a security requirement by modern browsers.

An online version will be made available soon.

## Why This App Exists

Most video editors don't expose variable font settings and OpenType features to users, making it impossible to create sophisticated typography animations directly within video editing software. This tool fills that gap by providing a dedicated environment for creating text animations that leverage the full power of modern typography.

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
3. Create text objects on the canvas
4. Adjust typography settings and OpenType features
5. Set keyframes on the timeline to create animations
6. Export your animation for use in video projects

## Browser Requirements

- Modern web browser with support for:
  - Variable fonts
  - Canvas API
  - ES6+ JavaScript features
  - CSS Grid and Flexbox

## Technical Details

Built with vanilla JavaScript, HTML5 Canvas, and modern CSS. No external dependencies required - runs entirely in the browser for maximum compatibility and performance.

---

*Created to bridge the gap between advanced typography and video production workflows.*