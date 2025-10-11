// Main application state and initialization
class FontAnimationApp {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.currentTool = 'hand';
        this.fonts = new Map();
        this.textObjects = [];
        this.selectedObject = null;
        this.selectedKeyframes = [];
        this.isPlaying = false;
        this.currentFrame = 0;
        this.totalFrames = 150; // 5 seconds at 30fps
        this.frameRate = window.AppSettings?.get('frameRate') || 30;
        this.duration = window.AppSettings?.get('duration') || 5;
        this.canvasWidth = window.AppSettings?.get('canvasWidth') || 1000;
        this.canvasHeight = window.AppSettings?.get('canvasHeight') || 600;
        this.canvasBackground = window.AppSettings?.get('canvasBackground') || '#ffffff';
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = window.AppSettings?.get('maxHistorySteps') || 50;
        this.missingFonts = new Set(); // Track fonts that were missing when project was loaded

        this.init();
    }

    checkBrowserCompatibility() {
        const incompatibleFeatures = [];
        const warnings = [];

        // Check for essential features
        if (!window.FontFace) {
            incompatibleFeatures.push('FontFace API (required for custom font loading)');
        }

        if (!document.fonts) {
            incompatibleFeatures.push('CSS Font Loading API');
        }

        if (!window.MediaRecorder) {
            warnings.push('MediaRecorder API (required for video export)');
        }

        if (!HTMLCanvasElement.prototype.toBlob) {
            warnings.push('Canvas.toBlob() (required for image export)');
        }

        if (!window.requestAnimationFrame) {
            incompatibleFeatures.push('requestAnimationFrame (required for smooth animation)');
        }

        // Check for ES6+ features
        try {
            eval('class Test {}');
            eval('const test = () => {};');
            eval('const {x} = {x:1}');
        } catch (e) {
            incompatibleFeatures.push('ES6+ JavaScript features (classes, arrow functions, destructuring)');
        }

        // Check Canvas 2D context
        const testCanvas = document.createElement('canvas');
        const testCtx = testCanvas.getContext('2d');
        if (!testCtx || !testCtx.fillText) {
            incompatibleFeatures.push('Canvas 2D text rendering');
        }

        // Check for CSS Grid and Flexbox
        const testDiv = document.createElement('div');
        testDiv.style.display = 'grid';
        if (testDiv.style.display !== 'grid') {
            incompatibleFeatures.push('CSS Grid Layout');
        }

        testDiv.style.display = 'flex';
        if (testDiv.style.display !== 'flex') {
            incompatibleFeatures.push('CSS Flexbox Layout');
        }

        // Show compatibility warnings
        if (incompatibleFeatures.length > 0 || warnings.length > 0) {
            this.showCompatibilityWarning(incompatibleFeatures, warnings);
            return incompatibleFeatures.length === 0; // Continue if only warnings, stop if critical features missing
        }

        return true;
    }

    showCompatibilityWarning(incompatibleFeatures, warnings) {
        // Create compatibility warning modal
        const modal = document.createElement('div');
        modal.className = 'modal compatibility-modal';
        modal.style.display = 'flex';
        modal.style.zIndex = '10000';

        const isBlocked = incompatibleFeatures.length > 0;
        const title = isBlocked ? 'Browser Not Supported' : 'Limited Browser Support';
        const message = isBlocked
            ? 'Your browser is missing essential features required for this application.'
            : 'Your browser is missing some features. The app will work but with limited functionality.';

        let compatibleBrowsers = `
            <div class="compatible-browsers">
                <h4>Recommended Browsers:</h4>
                <ul>
                    <li><strong>Chrome 88+</strong> - Full feature support</li>
                    <li><strong>Firefox 85+</strong> - Full feature support</li>
                    <li><strong>Safari 14+</strong> - Full feature support</li>
                    <li><strong>Edge 88+</strong> - Full feature support</li>
                </ul>
            </div>
        `;

        modal.innerHTML = `
            <div class="modal-content compatibility-content">
                <h2 style="color: ${isBlocked ? '#d32f2f' : '#f57c00'}">${title}</h2>
                <p>${message}</p>
                
                ${incompatibleFeatures.length > 0 ? `
                    <div class="missing-features">
                        <h4>Missing Critical Features:</h4>
                        <ul>
                            ${incompatibleFeatures.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${warnings.length > 0 ? `
                    <div class="limited-features">
                        <h4>Limited Features:</h4>
                        <ul>
                            ${warnings.map(feature => `<li>${feature}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                ${compatibleBrowsers}
                
                <div class="modal-buttons">
                    ${!isBlocked ? '<button id="continue-anyway" class="primary">Continue Anyway</button>' : ''}
                    <button id="close-compatibility">Close</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle button clicks
        const continueBtn = modal.querySelector('#continue-anyway');
        const closeBtn = modal.querySelector('#close-compatibility');

        if (continueBtn) {
            continueBtn.addEventListener('click', () => {
                modal.remove();
            });
        }

        closeBtn.addEventListener('click', () => {
            modal.remove();
            if (isBlocked) {
                // Hide the main app interface
                const app = document.getElementById('app');
                if (app) {
                    app.style.display = 'none';
                }
                // Show a simple message
                document.body.innerHTML += `
                    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; background: #2b2b2b; color: white; font-family: sans-serif; text-align: center;">
                        <div>
                            <h1>Browser Not Supported</h1>
                            <p>Please use a modern browser to access Font Animation Studio.</p>
                        </div>
                    </div>
                `;
            }
        });
    }

    init() {
        // Check browser compatibility first
        if (!this.checkBrowserCompatibility()) {
            return; // Stop initialization if browser is incompatible
        }

        this.setupCanvas();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.setupTimeline();
        this.setupFontManager();
        this.initializeUIFromSettings();
        this.saveState(); // Initial state
    }

    setupCanvas() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.updateCanvasSize();
        this.centerCanvas();

        // Listen for device pixel ratio changes (moving between different displays)
        this.setupPixelRatioListener();
    }

    setupPixelRatioListener() {
        // Create a media query to detect changes in device pixel ratio
        const mediaQuery = window.matchMedia(`(resolution: ${this.devicePixelRatio}dppx)`);

        const handlePixelRatioChange = () => {
            const newRatio = window.devicePixelRatio || 1;
            if (newRatio !== this.devicePixelRatio) {
                this.devicePixelRatio = newRatio;
                this.updateCanvasSize(); // Reconfigure canvas for new pixel ratio
            }
        };

        // Use the newer addEventListener if available, fallback to addListener
        if (mediaQuery.addEventListener) {
            mediaQuery.addEventListener('change', handlePixelRatioChange);
        } else {
            mediaQuery.addListener(handlePixelRatioChange);
        }

        // Also listen for window resize events which might indicate zoom changes
        window.addEventListener('resize', () => {
            // Debounce resize events
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = setTimeout(() => {
                const newRatio = window.devicePixelRatio || 1;
                if (newRatio !== this.devicePixelRatio) {
                    this.devicePixelRatio = newRatio;
                    this.updateCanvasSize();
                }
            }, 100);
        });
    }

    updateCanvasSize() {
        // Store current device pixel ratio in case it changed
        this.devicePixelRatio = window.devicePixelRatio || 1;

        // Set the actual canvas size to account for device pixel ratio
        this.canvas.width = this.canvasWidth * this.devicePixelRatio;
        this.canvas.height = this.canvasHeight * this.devicePixelRatio;

        // Set the CSS size to maintain the visual size
        this.canvas.style.width = this.canvasWidth + 'px';
        this.canvas.style.height = this.canvasHeight + 'px';
        this.canvas.style.backgroundColor = this.canvasBackground;

        // Reset and scale the context to match the device pixel ratio
        this.ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any existing transforms
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

        // Enable high-quality text rendering
        this.ctx.textRenderingOptimization = 'optimizeQuality';
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = 'left';

        this.totalFrames = Math.ceil(this.duration * this.frameRate);
        this.updateFrameTimeDisplay();
        this.redraw();
    }

    centerCanvas() {
        // Canvas is now centered using CSS flexbox in the container
        this.panX = 0;
        this.panY = 0;
        this.zoom = 1;
        this.updateCanvasTransform();
    }

    updateCanvasTransform() {
        this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.canvas.style.transformOrigin = 'center center';
    }

    setupEventListeners() {
        // Menu bar controls
        document.getElementById('canvasWidth').addEventListener('change', (e) => {
            this.canvasWidth = parseInt(e.target.value);
            this.updateCanvasSize();
            this.saveState();
        });

        document.getElementById('canvasHeight').addEventListener('change', (e) => {
            this.canvasHeight = parseInt(e.target.value);
            this.updateCanvasSize();
            this.saveState();
        });

        document.getElementById('canvasBackground').addEventListener('change', (e) => {
            this.canvasBackground = e.target.value;
            this.updateCanvasSize();
            this.saveState();
        });

        document.getElementById('frameRate').addEventListener('change', (e) => {
            this.frameRate = parseInt(e.target.value);
            this.totalFrames = Math.ceil(this.duration * this.frameRate);
            this.updateTimeline();
            this.updateFrameTimeDisplay();
            this.saveState();
        });

        document.getElementById('duration').addEventListener('change', (e) => {
            this.duration = parseFloat(e.target.value);
            this.totalFrames = Math.ceil(this.duration * this.frameRate);
            this.updateTimeline();
            this.updateFrameTimeDisplay();
            this.saveState();
        });

        // File operations
        document.getElementById('newBtn').addEventListener('click', () => this.newProject());
        document.getElementById('openBtn').addEventListener('click', () => this.openProject());
        document.getElementById('saveBtn').addEventListener('click', () => this.saveProject());
        document.getElementById('openFileInput').addEventListener('change', (e) => this.loadProject(e));

        // Tools
        document.getElementById('handTool').addEventListener('click', () => this.setTool('hand'));
        document.getElementById('zoomTool').addEventListener('click', () => this.setTool('zoom'));
        document.getElementById('textTool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('selectTool').addEventListener('click', () => this.setTool('select'));

        // Playback
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportVideo());

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // Canvas interactions
        this.setupCanvasEventListeners();

        // Timeline
        this.setupTimelineEventListeners();

        // Right panel
        this.setupRightPanelEventListeners();

        // Modal
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
        });

        document.getElementById('continueAnyway').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
        });
    }

    setupTimelineEventListeners() {
        const timeCursor = document.getElementById('timeCursor');
        const timelineHeader = document.getElementById('timelineHeader');
        const timeRuler = document.getElementById('timeRuler');

        let isDraggingCursor = false;

        // Helper function to calculate frame from mouse position
        const getFrameFromMouseEvent = (e) => {
            if (!timeRuler) return 0;
            const rect = timeRuler.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const frame = Math.round((x / rect.width) * this.totalFrames);
            return Math.max(0, Math.min(frame, this.totalFrames - 1));
        };

        // Handle mouse down on cursor (existing functionality)
        timeCursor.addEventListener('mousedown', (e) => {
            isDraggingCursor = true;
            e.preventDefault();
            e.stopPropagation();
        });

        // Handle mouse down on timeline ruler (new functionality)
        timeRuler.addEventListener('mousedown', (e) => {
            // Only start dragging if not clicking on the cursor itself
            if (e.target === timeCursor) return;

            isDraggingCursor = true;

            // Immediately set the frame for the click position
            const frame = getFrameFromMouseEvent(e);
            this.setCurrentFrame(frame);

            e.preventDefault();
        });

        // Handle mouse move (works for both cursor drag and ruler drag)
        timelineHeader.addEventListener('mousemove', (e) => {
            if (!isDraggingCursor) return;

            const frame = getFrameFromMouseEvent(e);
            this.setCurrentFrame(frame);
        });

        // Handle mouse up (stop dragging)
        document.addEventListener('mouseup', () => {
            isDraggingCursor = false;
        });

        // Keep the click handler for backwards compatibility, but it's now less needed
        timelineHeader.addEventListener('click', (e) => {
            // Skip if we were dragging (to avoid double-setting the frame)
            if (isDraggingCursor) return;
            if (e.target === timeCursor) return;

            const frame = getFrameFromMouseEvent(e);
            this.setCurrentFrame(frame);
        });
    }

    setupRightPanelEventListeners() {
        // Text properties
        document.getElementById('fontSelect').addEventListener('change', (e) => {
            if (this.selectedObject) {
                this.selectedObject.fontFamily = e.target.value;
                this.redraw();
                this.saveState();
            }
        });

        document.getElementById('fontSize').addEventListener('input', (e) => {
            if (this.selectedObject) {
                this.updateObjectProperty(this.selectedObject, 'fontSize', parseFloat(e.target.value));
                this.redraw();
            }
        });

        document.getElementById('fontSize').addEventListener('change', () => {
            this.saveState();
        });

        document.getElementById('fontColor').addEventListener('change', (e) => {
            if (this.selectedObject) {
                this.updateObjectProperty(this.selectedObject, 'color', e.target.value);
                this.redraw();
                this.saveState();
            }
        });

        document.getElementById('textContent').addEventListener('input', (e) => {
            if (this.selectedObject) {
                this.selectedObject.text = e.target.value;
                this.redraw();
            }
        });

        document.getElementById('textContent').addEventListener('change', () => {
            this.saveState();
        });

        // Position controls
        document.getElementById('textX').addEventListener('input', (e) => {
            if (this.selectedObject) {
                this.updateObjectProperty(this.selectedObject, 'x', parseFloat(e.target.value));
                this.redraw();
            }
        });

        document.getElementById('textX').addEventListener('change', () => {
            this.saveState();
        });

        document.getElementById('textY').addEventListener('input', (e) => {
            if (this.selectedObject) {
                this.updateObjectProperty(this.selectedObject, 'y', parseFloat(e.target.value));
                this.redraw();
            }
        });

        document.getElementById('textY').addEventListener('change', () => {
            this.saveState();
        });
    }

    setupCanvasEventListeners() {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartObjX = 0;
        let dragStartObjY = 0;

        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            // Calculate coordinates accounting for CSS scaling and device pixel ratio
            const scaleX = this.canvasWidth / rect.width;
            const scaleY = this.canvasHeight / rect.height;
            const x = (e.clientX - rect.left) * scaleX / this.zoom - this.panX / this.zoom;
            const y = (e.clientY - rect.top) * scaleY / this.zoom - this.panY / this.zoom;

            if (this.currentTool === 'text') {
                // Prompt for text input
                let text = prompt('Enter text:', 'Sample Text');
                // Only create text object if user didn't cancel and provided text
                if (text !== null && text.trim()) {
                    this.createTextObject(x, y, text.trim());
                }
            } else if (this.currentTool === 'select') {
                const clickedObject = this.selectObjectAt(x, y);
                if (clickedObject) {
                    isDragging = true;
                    dragStartX = x;
                    dragStartY = y;
                    dragStartObjX = clickedObject.x;
                    dragStartObjY = clickedObject.y;
                    this.canvas.style.cursor = 'grabbing';
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            if (!isDragging || !this.selectedObject) return;

            const rect = this.canvas.getBoundingClientRect();
            // Calculate coordinates accounting for CSS scaling and device pixel ratio
            const scaleX = this.canvasWidth / rect.width;
            const scaleY = this.canvasHeight / rect.height;
            const x = (e.clientX - rect.left) * scaleX / this.zoom - this.panX / this.zoom;
            const y = (e.clientY - rect.top) * scaleY / this.zoom - this.panY / this.zoom;

            const deltaX = x - dragStartX;
            const deltaY = y - dragStartY;

            const newX = dragStartObjX + deltaX;
            const newY = dragStartObjY + deltaY;

            this.updateObjectProperty(this.selectedObject, 'x', newX);
            this.updateObjectProperty(this.selectedObject, 'y', newY);

            this.updateRightPanel();
            this.redraw();
        });

        this.canvas.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.canvas.style.cursor = '';
                this.saveState();
            }
        });

        this.canvas.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                this.canvas.style.cursor = '';
                this.saveState();
            }
        });

        // Double-click to edit text
        this.canvas.addEventListener('dblclick', (e) => {
            if (this.selectedObject && this.currentTool === 'select') {
                const newText = prompt('Edit text:', this.selectedObject.text);
                if (newText !== null) {
                    this.selectedObject.text = newText;
                    this.redraw();
                    this.saveState();
                }
            }
        });
    }

    setupFontManager() {
        if (window.FontManager) {
            this.fontManager = new window.FontManager(this);
            console.log('Font manager initialized');
        } else {
            console.warn('FontManager not available');
        }
    }

    initializeUIFromSettings() {
        // Initialize UI input fields with values from settings
        if (window.AppSettings) {
            document.getElementById('canvasWidth').value = this.canvasWidth;
            document.getElementById('canvasHeight').value = this.canvasHeight;
            document.getElementById('canvasBackground').value = this.canvasBackground;
            document.getElementById('frameRate').value = this.frameRate;
            document.getElementById('duration').value = this.duration;
        }
    }

    // Test method to add a text object for debugging
    addTestText() {
        this.createTextObject(100, 100, 'Test Text');
        console.log('Test text added at 100, 100');
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Prevent shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'h':
                    this.setTool('hand');
                    break;
                case 'z':
                    if (e.metaKey || e.ctrlKey) {
                        if (e.shiftKey) {
                            this.redo();
                        } else {
                            this.undo();
                        }
                    } else {
                        this.setTool('zoom');
                    }
                    break;
                case 't':
                    this.setTool('text');
                    break;
                case 'v':
                    this.setTool('select');
                    break;
                case ' ':
                    e.preventDefault();
                    this.togglePlayback();
                    break;
                case 'delete':
                case 'backspace':
                    if (this.selectedObject) {
                        this.deleteSelectedObject();
                    }
                    break;
                case 'x':
                    // Test shortcut to add text
                    this.addTestText();
                    break;
                case 'arrowleft':
                    e.preventDefault();
                    if (e.metaKey || e.ctrlKey) {
                        // Cmd+Left: Jump to first frame
                        this.goToStart();
                    } else if (e.shiftKey) {
                        this.jumpBackward(10);
                    } else {
                        this.stepBackward();
                    }
                    break;
                case 'arrowright':
                    e.preventDefault();
                    if (e.metaKey || e.ctrlKey) {
                        // Cmd+Right: Jump to last frame
                        this.goToEnd();
                    } else if (e.shiftKey) {
                        this.jumpForward(10);
                    } else {
                        this.stepForward();
                    }
                    break;
                case 'e':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+E: Export video
                        this.exportVideo();
                    }
                    break;
            }
        });
    }

    setTool(tool) {
        this.currentTool = tool;

        // Update UI
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(tool + 'Tool').classList.add('active');

        // Update cursor classes
        this.canvas.className = this.canvas.className.replace(/\b\w+-cursor\b/g, '');
        this.canvas.classList.add(tool + '-cursor');
    }

    createTextObject(x, y, text = 'Sample Text') {
        // Get available fonts from font manager or use default
        let availableFonts = [];
        let defaultFont = 'Arial';

        if (this.fontManager && this.fontManager.fonts) {
            availableFonts = Array.from(this.fontManager.fonts.keys());
            this.fonts = this.fontManager.fonts; // Sync fonts
        } else {
            availableFonts = Array.from(this.fonts.keys());
        }

        if (availableFonts.length > 0) {
            defaultFont = availableFonts[0];
        }

        const textObject = {
            id: Date.now(),
            x: x,
            y: y,
            text: text,
            fontFamily: defaultFont,
            fontSize: window.AppSettings?.get('defaultFontSize') || 48,
            color: window.AppSettings?.get('defaultTextColor') || '#000000',
            variableAxes: {},
            openTypeFeatures: {},
            keyframes: [{
                frame: this.currentFrame,
                properties: {
                    x: x,
                    y: y,
                    fontSize: window.AppSettings?.get('defaultFontSize') || 48,
                    color: window.AppSettings?.get('defaultTextColor') || '#000000',
                    variableAxes: {},
                    openTypeFeatures: {}
                }
            }]
        };

        this.textObjects.push(textObject);
        this.selectedObject = textObject;

        this.updateTimeline();
        this.updateRightPanel();
        this.redraw();
        this.saveState();
    }

    selectObjectAt(x, y) {
        this.selectedObject = null;

        for (let i = this.textObjects.length - 1; i >= 0; i--) {
            const obj = this.textObjects[i];
            const props = this.getObjectPropertiesAtFrame(obj, this.currentFrame);

            // Create temporary canvas for text measurement
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.font = `${props.fontSize}px "${obj.fontFamily}"`;
            const metrics = tempCtx.measureText(obj.text);

            const bounds = this.getTextBounds(props, metrics);

            if (x >= bounds.left && x <= bounds.right &&
                y >= bounds.top && y <= bounds.bottom) {
                this.selectedObject = obj;
                break;
            }
        }

        this.updateRightPanel();
        this.redraw();
        return this.selectedObject;
    }

    getTextBounds(props, metrics) {
        const padding = 5;
        return {
            left: props.x - padding,
            top: props.y - padding,
            right: props.x + metrics.width + padding,
            bottom: props.y + props.fontSize + padding
        };
    }

    deleteSelectedObject() {
        if (this.selectedObject) {
            const index = this.textObjects.indexOf(this.selectedObject);
            if (index > -1) {
                this.textObjects.splice(index, 1);
                this.selectedObject = null;
                this.updateTimeline();
                this.updateRightPanel();
                this.redraw();
                this.saveState();
            }
        }
    }

    updateObjectProperty(obj, property, value) {
        console.log(`Updating ${property} to ${value} for object at frame ${this.currentFrame}`);

        // Update the direct property on the object
        obj[property] = value;

        // Also update the current keyframe if it exists
        const currentKeyframe = obj.keyframes.find(kf => kf.frame === this.currentFrame);
        if (currentKeyframe) {
            console.log('Updating existing keyframe');
            currentKeyframe.properties[property] = value;
        } else {
            console.log('Creating new keyframe');
            // If no keyframe exists for current frame, create one
            const newKeyframe = {
                frame: this.currentFrame,
                properties: {
                    x: obj.x,
                    y: obj.y,
                    fontSize: obj.fontSize,
                    color: obj.color,
                    variableAxes: obj.variableAxes || {},
                    openTypeFeatures: obj.openTypeFeatures || {}
                }
            };
            obj.keyframes.push(newKeyframe);
            obj.keyframes.sort((a, b) => a.frame - b.frame);

            // Update timeline UI when new keyframes are created
            if (this.timeline) {
                this.timeline.update();
            }
        }

        console.log('Object keyframes:', obj.keyframes);
    }

    zoomAt(x, y, factor) {
        const oldZoom = this.zoom;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom * factor));

        // Adjust pan to zoom towards the cursor position
        const zoomRatio = this.zoom / oldZoom;
        this.panX = (this.panX - x) * zoomRatio + x;
        this.panY = (this.panY - y) * zoomRatio + y;

        this.updateCanvasTransform();
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Draw text objects
        this.textObjects.forEach(obj => {
            this.drawTextObject(obj);
        });

        // Draw selection highlight
        if (this.selectedObject) {
            this.drawSelection(this.selectedObject);
        }
    }

    drawTextObject(obj) {
        this.ctx.save();

        const props = this.getObjectPropertiesAtFrame(obj, this.currentFrame);

        // Check if font is available in both our font map and document.fonts
        const fontAvailable = this.fonts.has(obj.fontFamily) && this.isFontLoaded(obj.fontFamily);

        let fontString;
        if (fontAvailable) {
            fontString = `${props.fontSize}px "${obj.fontFamily}"`;
        } else {
            // Use fallback font when the desired font is not available
            fontString = `${props.fontSize}px Arial, sans-serif`;
        }

        this.ctx.font = fontString;
        this.ctx.fillStyle = props.color;
        this.ctx.textBaseline = 'top';

        this.ctx.fillText(obj.text, props.x, props.y);
        this.ctx.restore();
    }

    // Check if a font is actually loaded and ready to use
    isFontLoaded(fontFamily) {
        // First check if the font is in document.fonts and loaded
        for (const font of document.fonts) {
            if (font.family === fontFamily && font.status === 'loaded') {
                return true;
            }
        }

        // Fallback: try to detect if font is available by checking document.fonts
        return document.fonts.check(`16px "${fontFamily}"`);
    }

    drawSelection(obj) {
        const props = this.getObjectPropertiesAtFrame(obj, this.currentFrame);

        // Create temporary canvas for text measurement
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Use proper canvas font syntax with fallbacks
        const fontAvailable = this.fonts.has(obj.fontFamily) && this.isFontLoaded(obj.fontFamily);

        let fontString;
        if (fontAvailable) {
            fontString = `${props.fontSize}px "${obj.fontFamily}"`;
        } else {
            fontString = `${props.fontSize}px Arial, sans-serif`;
        }

        tempCtx.font = fontString;
        const metrics = tempCtx.measureText(obj.text); this.ctx.save();
        this.ctx.strokeStyle = '#0078d4';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);

        const bounds = this.getTextBounds(props, metrics);
        this.ctx.strokeRect(bounds.left, bounds.top,
            bounds.right - bounds.left, bounds.bottom - bounds.top);

        this.ctx.restore();
    }

    getObjectPropertiesAtFrame(obj, frame) {
        const keyframes = obj.keyframes.sort((a, b) => a.frame - b.frame);

        if (keyframes.length === 0) {
            const props = {
                x: obj.x,
                y: obj.y,
                fontSize: obj.fontSize,
                color: obj.color,
                variableAxes: obj.variableAxes || {},
                openTypeFeatures: obj.openTypeFeatures || {}
            };
            console.log('No keyframes, returning direct props:', props);
            return props;
        }

        if (keyframes.length === 1 || frame <= keyframes[0].frame) {
            console.log('Using first keyframe props:', keyframes[0].properties);
            return keyframes[0].properties;
        }

        if (frame >= keyframes[keyframes.length - 1].frame) {
            console.log('Using last keyframe props:', keyframes[keyframes.length - 1].properties);
            return keyframes[keyframes.length - 1].properties;
        }

        // Find surrounding keyframes
        let beforeKeyframe = keyframes[0];
        let afterKeyframe = keyframes[keyframes.length - 1];

        for (let i = 0; i < keyframes.length - 1; i++) {
            if (frame >= keyframes[i].frame && frame <= keyframes[i + 1].frame) {
                beforeKeyframe = keyframes[i];
                afterKeyframe = keyframes[i + 1];
                break;
            }
        }

        // Interpolate between keyframes
        const t = (frame - beforeKeyframe.frame) / (afterKeyframe.frame - beforeKeyframe.frame);

        return this.interpolateProperties(beforeKeyframe.properties, afterKeyframe.properties, t, beforeKeyframe.curve);
    }

    interpolateProperties(start, end, t, curve = null) {
        // Apply curve if available
        if (curve) {
            t = this.evaluateBezierCurve(t, curve);
        }

        return {
            x: start.x + (end.x - start.x) * t,
            y: start.y + (end.y - start.y) * t,
            fontSize: start.fontSize + (end.fontSize - start.fontSize) * t,
            color: this.interpolateColor(start.color, end.color, t),
            variableAxes: this.interpolateVariableAxes(start.variableAxes || {}, end.variableAxes || {}, t),
            openTypeFeatures: end.openTypeFeatures || start.openTypeFeatures || {}
        };
    }

    interpolateColor(color1, color2, t) {
        const c1 = this.hexToRgb(color1);
        const c2 = this.hexToRgb(color2);

        if (!c1 || !c2) return color1;

        const r = Math.round(c1.r + (c2.r - c1.r) * t);
        const g = Math.round(c1.g + (c2.g - c1.g) * t);
        const b = Math.round(c1.b + (c2.b - c1.b) * t);

        return this.rgbToHex(r, g, b);
    }

    interpolateVariableAxes(axes1, axes2, t) {
        const result = { ...axes1 };

        Object.keys(axes2).forEach(axis => {
            const start = axes1[axis] || 0;
            const end = axes2[axis];
            result[axis] = start + (end - start) * t;
        });

        return result;
    }

    evaluateBezierCurve(t, curve) {
        const cp1x = curve.cp1x / 100;
        const cp1y = curve.cp1y / 100;
        const cp2x = curve.cp2x / 100;
        const cp2y = curve.cp2y / 100;

        const mt = 1 - t;
        const mt2 = mt * mt;
        const t2 = t * t;

        return 3 * mt2 * t * cp1y + 3 * mt * t2 * cp2y + t2 * t;
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    // State management
    saveState() {
        const state = {
            textObjects: JSON.parse(JSON.stringify(this.textObjects)),
            currentFrame: this.currentFrame,
            canvasWidth: this.canvasWidth,
            canvasHeight: this.canvasHeight,
            canvasBackground: this.canvasBackground,
            frameRate: this.frameRate,
            duration: this.duration
        };

        if (this.historyIndex < this.history.length - 1) {
            this.history = this.history.slice(0, this.historyIndex + 1);
        }

        this.history.push(state);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        } else {
            this.historyIndex++;
        }
    }

    undo() {
        if (this.historyIndex > 0) {
            this.historyIndex--;
            this.loadState(this.history[this.historyIndex]);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            this.historyIndex++;
            this.loadState(this.history[this.historyIndex]);
        }
    }

    loadState(state) {
        this.textObjects = JSON.parse(JSON.stringify(state.textObjects));
        this.currentFrame = state.currentFrame;
        this.canvasWidth = state.canvasWidth;
        this.canvasHeight = state.canvasHeight;
        this.canvasBackground = state.canvasBackground || '#ffffff';
        this.frameRate = state.frameRate;
        this.duration = state.duration;

        // Clear selection to prevent lingering selection boxes
        this.selectedObject = null;

        // Update UI
        document.getElementById('canvasWidth').value = this.canvasWidth;
        document.getElementById('canvasHeight').value = this.canvasHeight;
        document.getElementById('canvasBackground').value = this.canvasBackground;
        document.getElementById('frameRate').value = this.frameRate;
        document.getElementById('duration').value = this.duration;

        this.updateCanvasSize();
        this.updateTimeline();
        this.redraw();

        // Update the right panel to reflect the cleared selection
        if (window.UIManager) {
            window.UIManager.updateRightPanel();
        }
    }

    // Placeholder methods to be implemented in other files
    setupTimeline() {
        if (window.TimelineManager) {
            this.timeline = new TimelineManager(this);
        }
    }

    updateTimeline() {
        if (this.timeline) {
            this.timeline.update();
        }
    }

    setCurrentFrame(frame) {
        this.currentFrame = frame;
        if (this.timeline) {
            this.timeline.updateCursor();
        }
        this.updateFrameTimeDisplay();
        this.redraw();
    }

    updateFrameTimeDisplay() {
        const currentFrameDisplay = document.getElementById('currentFrameDisplay');
        const totalFramesDisplay = document.getElementById('totalFramesDisplay');
        const currentTimeDisplay = document.getElementById('currentTimeDisplay');

        if (currentFrameDisplay) {
            currentFrameDisplay.textContent = this.currentFrame.toString();
        }
        if (totalFramesDisplay) {
            totalFramesDisplay.textContent = this.totalFrames.toString();
        }
        if (currentTimeDisplay) {
            const totalSeconds = this.currentFrame / this.frameRate;
            const seconds = Math.floor(totalSeconds);
            const frames = this.currentFrame % this.frameRate;
            currentTimeDisplay.textContent = `${seconds}s+${frames}f`;
        }
    }

    // Frame navigation methods
    stepForward() {
        if (window.AnimationManager) {
            if (!this.animationManager) {
                this.animationManager = new window.AnimationManager(this);
            }
            this.animationManager.stepForward();
        }
    }

    stepBackward() {
        if (window.AnimationManager) {
            if (!this.animationManager) {
                this.animationManager = new window.AnimationManager(this);
            }
            this.animationManager.stepBackward();
        }
    }

    jumpForward(frames = 10) {
        const targetFrame = Math.min(this.currentFrame + frames, this.totalFrames - 1);
        this.setCurrentFrame(targetFrame);
    }

    jumpBackward(frames = 10) {
        const targetFrame = Math.max(this.currentFrame - frames, 0);
        this.setCurrentFrame(targetFrame);
    }

    goToStart() {
        if (window.AnimationManager) {
            if (!this.animationManager) {
                this.animationManager = new window.AnimationManager(this);
            }
            this.animationManager.goToStart();
        }
    }

    goToEnd() {
        if (window.AnimationManager) {
            if (!this.animationManager) {
                this.animationManager = new window.AnimationManager(this);
            }
            this.animationManager.goToEnd();
        }
    }

    updateRightPanel() {
        if (window.UIManager) {
            window.UIManager.updateRightPanel(this);
        }
    }

    togglePlayback() {
        if (window.AnimationManager) {
            window.AnimationManager.togglePlayback(this);
        }
    }

    async exportVideo() {
        const exportBtn = document.getElementById('exportBtn');
        const exportIcon = exportBtn.querySelector('span');

        if (!exportBtn || !window.ExportManager) {
            return;
        }

        try {
            // Set button to exporting state
            exportBtn.disabled = true;
            exportBtn.classList.add('exporting');
            exportIcon.textContent = 'hourglass_empty';
            exportBtn.title = 'Exporting...';

            // Perform export
            await window.ExportManager.exportVideo(this);

        } catch (error) {
            console.error('Export error:', error);
            if (window.UIManager) {
                window.UIManager.createNotification('Export failed: ' + error.message, 'error');
            }
        } finally {
            // Reset button state
            exportBtn.disabled = false;
            exportBtn.classList.remove('exporting');
            exportIcon.textContent = 'videocam';
            exportBtn.title = 'Export Video';
        }
    }

    newProject() {
        this.textObjects = [];
        this.selectedObject = null;
        this.currentFrame = 0;
        this.canvasWidth = window.AppSettings?.get('canvasWidth') || 1000;
        this.canvasHeight = window.AppSettings?.get('canvasHeight') || 600;
        this.canvasBackground = window.AppSettings?.get('canvasBackground') || '#ffffff';
        this.frameRate = 30;
        this.duration = 5;
        this.history = [];
        this.historyIndex = -1;
        this.missingFonts.clear(); // Clear any previously missing fonts

        // Update UI
        document.getElementById('canvasWidth').value = this.canvasWidth;
        document.getElementById('canvasHeight').value = this.canvasHeight;
        document.getElementById('canvasBackground').value = this.canvasBackground;
        document.getElementById('frameRate').value = this.frameRate;
        document.getElementById('duration').value = this.duration;

        this.updateCanvasSize();
        this.saveState();
        this.updateTimeline();
        this.updateFrameTimeDisplay();
        this.updateRightPanel();
        this.redraw();
    }

    saveProject() {
        const project = {
            version: window.AppSettings?.get('fileFormatVersion') || '1.1',
            textObjects: this.textObjects,
            settings: {
                canvasWidth: this.canvasWidth,
                canvasHeight: this.canvasHeight,
                canvasBackground: this.canvasBackground,
                frameRate: this.frameRate,
                duration: this.duration
            },
            fonts: Array.from(this.fonts.keys())
        };

        const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'animation.json';
        a.click();
        URL.revokeObjectURL(url);
    }

    openProject() {
        document.getElementById('openFileInput').click();
    }

    loadProject(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const project = JSON.parse(e.target.result);
                this.loadProjectData(project);
            } catch (error) {
                console.error('Error loading project:', error);
                if (window.UIManager) {
                    window.UIManager.createNotification('Error loading project file: ' + error.message, 'error');
                }
            }
        };
        reader.readAsText(file);
    }

    loadProjectData(project) {
        const missingFonts = project.fonts.filter(fontName => !this.fonts.has(fontName));

        // Store missing fonts for later checking
        this.missingFonts.clear();
        missingFonts.forEach(font => this.missingFonts.add(font));

        if (missingFonts.length > 0) {
            const modal = document.getElementById('warningModal');
            const list = document.getElementById('missingFontsList');
            list.innerHTML = missingFonts.map(font => `<li>${font}</li>`).join('');
            modal.style.display = 'flex';
        }

        this.textObjects = project.textObjects || [];
        if (project.settings) {
            this.canvasWidth = project.settings.canvasWidth;
            this.canvasHeight = project.settings.canvasHeight;
            this.canvasBackground = project.settings.canvasBackground || '#ffffff';
            this.frameRate = project.settings.frameRate;
            this.duration = project.settings.duration;
        }

        this.selectedObject = null;
        this.currentFrame = 0;
        this.history = [];
        this.historyIndex = -1;

        // Update UI
        document.getElementById('canvasWidth').value = this.canvasWidth;
        document.getElementById('canvasHeight').value = this.canvasHeight;
        document.getElementById('canvasBackground').value = this.canvasBackground;
        document.getElementById('frameRate').value = this.frameRate;
        document.getElementById('duration').value = this.duration;

        this.updateCanvasSize();
        this.saveState();
        this.updateTimeline();
        this.updateFrameTimeDisplay();
        this.updateRightPanel();
        this.redraw();
    }

    // Check if any previously missing fonts are now available and update text objects
    checkForResolvedMissingFonts() {
        if (this.missingFonts.size === 0) {
            return;
        }

        const resolvedFonts = [];
        for (const fontName of this.missingFonts) {
            if (this.fonts.has(fontName)) {
                resolvedFonts.push(fontName);
                this.missingFonts.delete(fontName);
            }
        }

        if (resolvedFonts.length > 0) {
            console.log('Resolved missing fonts:', resolvedFonts);
            console.log('Available fonts in app.fonts:', Array.from(this.fonts.keys()));

            // Update any text objects that were using fallback fonts
            let hasUpdates = false;
            this.textObjects.forEach(obj => {
                if (resolvedFonts.includes(obj.fontFamily)) {
                    console.log(`Text object "${obj.text}" can now use font: ${obj.fontFamily}`);
                    hasUpdates = true;
                }
            });

            if (hasUpdates) {
                console.log('Updating UI and redrawing canvas...');

                // Update the right panel in case the selected object's font is now available
                this.updateRightPanel();

                // Trigger a redraw to show the correct fonts
                this.redraw();

                if (window.UIManager) {
                    const fontList = resolvedFonts.join(', ');
                    window.UIManager.createNotification(`Font(s) now available: ${fontList}`, 'success');
                }
            }
        }
    }
}

// Initialize the application when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.app = new FontAnimationApp();
});