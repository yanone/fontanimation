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
        this.frameRate = window.AppSettings?.getValue('frameRate') || 30;
        this.duration = window.AppSettings?.getValue('duration') || 5;
        this.canvasWidth = window.AppSettings?.getValue('canvasWidth') || 1000;
        this.canvasHeight = window.AppSettings?.getValue('canvasHeight') || 600;
        this.canvasBackground = window.AppSettings?.getValue('canvasBackground') || '#ffffff';
        this.zoom = 1;
        this.panX = 0;
        this.panY = 0;
        this.history = [];
        this.historyIndex = -1;
        this.maxHistory = window.AppSettings?.getValue('maxHistorySteps') || 50;
        this.missingFonts = new Set(); // Track fonts that were missing when project was loaded
        this.spacePanning = false; // Track if space bar is being held for temporary panning
        this.previousTool = 'select'; // Store previous tool for space bar panning

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
        this.setupTimelineDivider();
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
        const canvasWrapper = document.getElementById('canvasWrapper');
        const canvasOverlay = document.getElementById('canvasOverlay');

        if (!canvasWrapper) return;

        // Calculate the space needed for the scaled canvas
        const baseMargin = 100; // Minimum margin around canvas
        const scaledWidth = this.canvasWidth * this.zoom;
        const scaledHeight = this.canvasHeight * this.zoom;

        // Calculate minimum wrapper size needed to accommodate scaled canvas
        const scrollArea = document.getElementById('canvasScrollArea');
        const viewportWidth = scrollArea ? scrollArea.clientWidth : 1000;
        const viewportHeight = scrollArea ? scrollArea.clientHeight : 600;

        // Calculate wrapper size based on whether scrollbars are needed
        // Only add margins and make wrapper larger if the scaled canvas exceeds viewport
        let wrapperWidth, wrapperHeight;

        if (scaledWidth + (baseMargin * 2) > viewportWidth) {
            // Canvas is larger than viewport - need horizontal scrolling
            wrapperWidth = scaledWidth + (baseMargin * 2);
        } else {
            // Canvas fits in viewport - no horizontal scrolling needed
            wrapperWidth = viewportWidth;
        }

        if (scaledHeight + (baseMargin * 2) > viewportHeight) {
            // Canvas is larger than viewport - need vertical scrolling
            wrapperHeight = scaledHeight + (baseMargin * 2);
        } else {
            // Canvas fits in viewport - no vertical scrolling needed
            wrapperHeight = viewportHeight;
        }

        canvasWrapper.style.width = `${wrapperWidth}px`;
        canvasWrapper.style.height = `${wrapperHeight}px`;

        // Control scrollbar visibility explicitly
        const needsHorizontalScroll = scaledWidth + (baseMargin * 2) > viewportWidth;
        const needsVerticalScroll = scaledHeight + (baseMargin * 2) > viewportHeight;

        if (needsHorizontalScroll && needsVerticalScroll) {
            scrollArea.style.overflow = 'auto';
        } else if (needsHorizontalScroll) {
            scrollArea.style.overflowX = 'auto';
            scrollArea.style.overflowY = 'hidden';
        } else if (needsVerticalScroll) {
            scrollArea.style.overflowX = 'hidden';
            scrollArea.style.overflowY = 'auto';
        } else {
            scrollArea.style.overflow = 'hidden';
        }

        // Apply zoom transform to canvas (panning is handled by scrollbars)
        // The flex centering in CSS will handle the base centering
        this.canvas.style.position = 'relative';
        this.canvas.style.transform = `scale(${this.zoom})`;
        this.canvas.style.transformOrigin = 'center center';

        if (canvasOverlay) {
            canvasOverlay.style.position = 'absolute';
            canvasOverlay.style.left = '50%';
            canvasOverlay.style.top = '50%';
            canvasOverlay.style.width = `${this.canvasWidth}px`;
            canvasOverlay.style.height = `${this.canvasHeight}px`;
            canvasOverlay.style.transform = `translate(-50%, -50%) scale(${this.zoom})`;
            canvasOverlay.style.transformOrigin = 'center center';
        }

        this.updateZoomDisplay();
    }

    centerViewportOnCanvas() {
        const scrollArea = document.getElementById('canvasScrollArea');
        if (!scrollArea) return;

        // Wait for DOM to update after transform changes
        requestAnimationFrame(() => {
            // Reset pan to center position
            this.panX = 0;
            this.panY = 0;

            // Update canvas transform
            this.updateCanvasTransform();

            // Wait another frame for layout to complete
            requestAnimationFrame(() => {
                // Center the scroll position
                const maxScrollLeft = scrollArea.scrollWidth - scrollArea.clientWidth;
                const maxScrollTop = scrollArea.scrollHeight - scrollArea.clientHeight;

                if (maxScrollLeft > 0) {
                    scrollArea.scrollLeft = maxScrollLeft / 2;
                }
                if (maxScrollTop > 0) {
                    scrollArea.scrollTop = maxScrollTop / 2;
                }
            });
        });
    }

    updateZoomDisplay() {
        const zoomPercentage = Math.round(this.zoom * 100);
        const zoomDisplay = document.getElementById('currentZoomDisplay');
        if (zoomDisplay) {
            zoomDisplay.textContent = `${zoomPercentage}%`;
        }
    }

    getZoomLevels() {
        return [0.1, 0.25, 0.33, 0.5, 0.67, 0.75, 1.0, 1.25, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0];
    }

    findNearestZoomLevel(currentZoom) {
        const levels = this.getZoomLevels();
        let closest = levels[0];
        let minDiff = Math.abs(currentZoom - closest);

        for (const level of levels) {
            const diff = Math.abs(currentZoom - level);
            if (diff < minDiff) {
                minDiff = diff;
                closest = level;
            }
        }
        return closest;
    }

    zoomIn() {
        const levels = this.getZoomLevels();
        const currentIndex = levels.findIndex(level => level >= this.zoom);

        if (currentIndex === -1) {
            // Current zoom is higher than all predefined levels, use the highest
            this.zoom = levels[levels.length - 1];
        } else if (currentIndex < levels.length - 1) {
            // Move to next level
            this.zoom = levels[currentIndex + 1];
        }
        // If already at max level, do nothing

        this.updateCanvasTransform();
        this.centerViewportOnCanvas();
    }

    zoomOut() {
        const levels = this.getZoomLevels();
        const currentIndex = levels.findIndex(level => level >= this.zoom);

        if (currentIndex === -1) {
            // Current zoom is higher than all levels, find the closest smaller one
            this.zoom = levels[levels.length - 1];
        } else if (currentIndex > 0) {
            // Move to previous level
            this.zoom = levels[currentIndex - 1];
        } else if (currentIndex === 0 && this.zoom > levels[0]) {
            // Current zoom is between first level and next, go to first level
            this.zoom = levels[0];
        }
        // If already at min level, do nothing

        this.updateCanvasTransform();
        this.centerViewportOnCanvas();
    }

    resetZoom() {
        this.zoom = 1.0;
        this.updateCanvasTransform();
        this.centerViewportOnCanvas();
    }

    setupEventListeners() {
        // Menu bar controls
        document.getElementById('canvasWidth').addEventListener('change', (e) => {
            const maxWidth = 3840; // 4K width limit
            let newWidth = parseInt(e.target.value);

            // Constrain to maximum 4K width
            if (newWidth > maxWidth) {
                newWidth = maxWidth;
                e.target.value = newWidth;
                if (window.UIManager) {
                    window.UIManager.createNotification(`Canvas width limited to 4K maximum (${maxWidth}px)`, 'warning');
                }
            }

            this.canvasWidth = newWidth;
            this.updateCanvasSize();
            this.saveState();
        });

        document.getElementById('canvasHeight').addEventListener('change', (e) => {
            const maxHeight = 2160; // 4K height limit
            let newHeight = parseInt(e.target.value);

            // Constrain to maximum 4K height
            if (newHeight > maxHeight) {
                newHeight = maxHeight;
                e.target.value = newHeight;
                if (window.UIManager) {
                    window.UIManager.createNotification(`Canvas height limited to 4K maximum (${maxHeight}px)`, 'warning');
                }
            }

            this.canvasHeight = newHeight;
            this.updateCanvasSize();
            this.saveState();
        });

        document.getElementById('canvasBackgroundColor').addEventListener('change', (e) => {
            this.canvasBackground = e.target.value;
            this.updateCanvasSize();
            this.redraw(); // Ensure canvas is redrawn with new background
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
        document.getElementById('textTool').addEventListener('click', () => this.setTool('text'));
        document.getElementById('selectTool').addEventListener('click', () => this.setTool('select'));

        // Playback
        document.getElementById('playBtn').addEventListener('click', () => this.togglePlayback());
        document.getElementById('exportBtn').addEventListener('click', () => this.exportVideo());

        // About
        document.getElementById('aboutBtn').addEventListener('click', () => this.showAboutModal());

        // Undo/Redo
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('redoBtn').addEventListener('click', () => this.redo());

        // Canvas interactions
        this.setupCanvasEventListeners();

        // Timeline ruler interaction
        this.setupTimelineRulerClick();

        // Right panel
        this.setupRightPanelEventListeners();

        // Modal
        document.querySelector('.close').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
        });

        document.getElementById('continueAnyway').addEventListener('click', () => {
            document.getElementById('warningModal').style.display = 'none';
        });

        // About modal close handler
        const aboutModal = document.getElementById('aboutModal');
        const aboutCloseBtn = aboutModal.querySelector('.close');
        if (aboutCloseBtn) {
            aboutCloseBtn.addEventListener('click', () => {
                aboutModal.style.display = 'none';
            });
        }
    }



    setupRightPanelEventListeners() {
        // Text properties
        document.getElementById('fontSelect').addEventListener('change', (e) => {
            if (this.selectedObject) {
                this.selectedObject.fontFamily = e.target.value;
                this.updateRightPanel(); // Redraw sidebar to reflect new font properties
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

        document.getElementById('textAlign').addEventListener('change', (e) => {
            if (this.selectedObject) {
                this.selectedObject.textAlign = e.target.value;
                this.redraw();
                this.saveState();
            }
        });

        document.getElementById('textContent').addEventListener('input', (e) => {
            if (this.selectedObject) {
                this.selectedObject.text = e.target.value;
                this.updateTimeline(); // Update timeline to reflect text change
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

        // Keyframe button event listeners
        document.querySelectorAll('.keyframe-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const property = btn.dataset.property;
                if (this.selectedObject) {
                    this.toggleKeyframe(this.selectedObject, property);
                }
            });
        });

        // Transition button event listeners
        document.querySelectorAll('.transition-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();

                // Don't open if button is disabled
                if (btn.disabled) return;

                const property = btn.dataset.property;
                if (this.selectedObject && window.TransitionEditor) {
                    window.TransitionEditor.openModal(this.selectedObject, property, this);
                }
            });
        });
    }

    // Toggle keyframe for a property at current frame
    toggleKeyframe(textObject, property) {
        if (this.hasKeyframe(textObject, property, this.currentFrame)) {
            // Remove keyframe
            this.removeKeyframe(textObject, property, this.currentFrame);
        } else {
            // Add keyframe with current value
            const currentValue = this.getPropertyValue(textObject, property, this.currentFrame);
            this.setKeyframe(textObject, property, this.currentFrame, currentValue);
        }

        this.timeline.update();
        this.updateRightPanel();
        this.redraw(); // Repaint canvas to reflect changes
        this.saveState();
    }

    setupTimelineRulerClick() {
        const timeRuler = document.getElementById('timeRuler');
        if (!timeRuler) return;

        let isDragging = false;

        // Helper function to calculate frame from mouse position
        const getFrameFromEvent = (e) => {
            const timelineHeader = document.getElementById('timelineHeader');
            const headerRect = timelineHeader.getBoundingClientRect();
            const headerScrollLeft = timelineHeader ? timelineHeader.scrollLeft : 0;

            // Calculate position relative to the timeline header container, then add scroll offset
            const x = (e.clientX - headerRect.left) + headerScrollLeft;

            // Convert pixel position to frame
            const pixelsPerFrame = this.timeline.calculateTimelineWidth() / this.totalFrames;
            const frame = Math.round(x / pixelsPerFrame);
            return Math.max(0, Math.min(frame, this.totalFrames - 1));
        };

        // Mouse down - start dragging or click
        timeRuler.addEventListener('mousedown', (e) => {
            // Skip if clicking on the time cursor itself
            if (e.target.id === 'timeCursor') return;

            isDragging = true;
            const frame = getFrameFromEvent(e);
            this.setCurrentFrame(frame);

            e.preventDefault();
        });

        // Mouse move - drag to scrub timeline
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const frame = getFrameFromEvent(e);
            this.setCurrentFrame(frame);
        });

        // Mouse up - stop dragging
        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Keep the click handler for backwards compatibility
        timeRuler.addEventListener('click', (e) => {
            // Skip if we were dragging or clicking on cursor
            if (isDragging || e.target.id === 'timeCursor') return;

            const frame = getFrameFromEvent(e);
            this.setCurrentFrame(frame);
        });
    }

    setupCanvasEventListeners() {
        let isDragging = false;
        let dragStartX = 0;
        let dragStartY = 0;
        let dragStartObjX = 0;
        let dragStartObjY = 0;
        let hasDuplicated = false; // Track if object was duplicated during this drag

        this.canvas.addEventListener('mousedown', (e) => {
            // Transform mouse coordinates to canvas space accounting for zoom and pan
            const coords = this.screenToCanvasCoordinates(e.clientX, e.clientY);
            const x = coords.x;
            const y = coords.y;

            if (this.currentTool === 'hand') {
                // Initialize hand tool panning
                this.handleHandToolStart(e);
            } else if (this.currentTool === 'text') {
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
                    hasDuplicated = false; // Reset duplication flag
                    dragStartX = x;
                    dragStartY = y;
                    dragStartObjX = this.getPropertyValue(clickedObject, 'x');
                    dragStartObjY = this.getPropertyValue(clickedObject, 'y');
                    this.canvas.style.cursor = 'grabbing';
                }
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            // Handle hand tool panning
            if (this.currentTool === 'hand') {
                this.handleHandToolDrag(e);
                return;
            }

            if (!isDragging || !this.selectedObject) return;

            // Handle Alt key duplication (only once per drag operation)
            if (e.altKey && !hasDuplicated) {
                const duplicated = this.duplicateObject(this.selectedObject);
                this.selectedObject = duplicated; // Switch to working with the duplicate
                hasDuplicated = true;

                // Update the cursor to indicate duplication
                this.canvas.style.cursor = 'copy';
            }

            // Transform mouse coordinates to canvas space accounting for zoom and pan
            const coords = this.screenToCanvasCoordinates(e.clientX, e.clientY);
            const x = coords.x;
            const y = coords.y;

            let deltaX = x - dragStartX;
            let deltaY = y - dragStartY;

            // Constrain movement to 90° angles when shift key is held
            if (e.shiftKey) {
                const angle = Math.atan2(deltaY, deltaX);
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

                // Snap to nearest 90° angle (0°, 90°, 180°, 270°)
                const snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);

                deltaX = distance * Math.cos(snapAngle);
                deltaY = distance * Math.sin(snapAngle);
            }

            const newX = dragStartObjX + deltaX;
            const newY = dragStartObjY + deltaY;

            this.updateObjectProperty(this.selectedObject, 'x', newX);
            this.updateObjectProperty(this.selectedObject, 'y', newY);

            this.redraw();
        });

        this.canvas.addEventListener('mouseup', (e) => {
            // Handle hand tool panning
            if (this.currentTool === 'hand') {
                this.handleHandToolEnd(e);
                return;
            }

            if (isDragging) {
                isDragging = false;
                hasDuplicated = false; // Reset duplication flag
                this.canvas.style.cursor = '';
                this.updateRightPanel();
                this.saveState();
            }
        });

        this.canvas.addEventListener('mouseleave', (e) => {
            // Handle hand tool panning
            if (this.currentTool === 'hand') {
                this.handleHandToolEnd(e);
            }

            if (isDragging) {
                isDragging = false;
                hasDuplicated = false; // Reset duplication flag
                this.canvas.style.cursor = '';
                this.updateRightPanel();
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

        // Wheel zoom support
        this.canvas.addEventListener('wheel', (e) => {
            if (e.metaKey || e.ctrlKey) {
                e.preventDefault();
                if (e.deltaY < 0) {
                    // Scroll up = zoom in
                    this.zoomIn();
                } else {
                    // Scroll down = zoom out
                    this.zoomOut();
                }
            }
        });
    }

    // Duplicate an object with all its properties and keyframes
    duplicateObject(sourceObject) {
        // Create a deep copy of the object
        const duplicate = {
            id: Date.now(), // Give it a new unique ID
            text: sourceObject.text,
            font: sourceObject.font,
            textAlign: sourceObject.textAlign,
            keyframes: {}
        };

        // Deep copy all keyframes for each property
        Object.keys(sourceObject.keyframes).forEach(property => {
            duplicate.keyframes[property] = sourceObject.keyframes[property].map(keyframe => ({
                frame: keyframe.frame,
                value: keyframe.value,
                curve: keyframe.curve ? {
                    cp1x: keyframe.curve.cp1x,
                    cp1y: keyframe.curve.cp1y,
                    cp2x: keyframe.curve.cp2x,
                    cp2y: keyframe.curve.cp2y
                } : undefined
            }));
        });

        // Add the duplicate to the objects array
        this.textObjects.push(duplicate);

        // Update UI to reflect the new object
        if (this.timeline) {
            this.timeline.updateLayers();
        }

        return duplicate;
    }

    // Hand tool panning methods
    handleHandToolStart(event) {
        // Store initial mouse position and current scroll positions for panning
        const canvasScrollArea = document.getElementById('canvasScrollArea');
        if (!canvasScrollArea) return;

        this.panStartMouseX = event.clientX;
        this.panStartMouseY = event.clientY;
        this.panStartScrollX = canvasScrollArea.scrollLeft;
        this.panStartScrollY = canvasScrollArea.scrollTop;

        // Add grabbing cursor and disable smooth scrolling for performance
        this.canvas.classList.add('grabbing');
        canvasScrollArea.classList.add('panning');

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
    }

    handleHandToolDrag(event) {
        if (this.panStartMouseX === undefined || this.panStartMouseY === undefined) return;

        const canvasScrollArea = document.getElementById('canvasScrollArea');
        if (!canvasScrollArea) return;

        // Cancel any pending animation frame to avoid accumulating updates
        if (this.panAnimationFrame) {
            cancelAnimationFrame(this.panAnimationFrame);
        }

        // Use requestAnimationFrame for smooth 60fps updates
        this.panAnimationFrame = requestAnimationFrame(() => {
            // Calculate mouse delta (inverted for natural panning feel)
            const deltaX = this.panStartMouseX - event.clientX;
            const deltaY = this.panStartMouseY - event.clientY;

            // Update scroll positions - this moves the scrollbars
            canvasScrollArea.scrollLeft = this.panStartScrollX + deltaX;
            canvasScrollArea.scrollTop = this.panStartScrollY + deltaY;
        });

        // Prevent default to stop any other behavior
        event.preventDefault();
        event.stopPropagation();
    }

    handleHandToolEnd() {
        const canvasScrollArea = document.getElementById('canvasScrollArea');

        // Cancel any pending animation frame
        if (this.panAnimationFrame) {
            cancelAnimationFrame(this.panAnimationFrame);
            this.panAnimationFrame = null;
        }

        // Clean up pan state
        this.panStartMouseX = undefined;
        this.panStartMouseY = undefined;
        this.panStartScrollX = undefined;
        this.panStartScrollY = undefined;

        // Remove grabbing cursor and re-enable smooth scrolling
        this.canvas.classList.remove('grabbing');
        if (canvasScrollArea) {
            canvasScrollArea.classList.remove('panning');
        }
    }

    // Transform screen coordinates to canvas coordinates accounting for zoom and scroll position
    screenToCanvasCoordinates(screenX, screenY) {
        const canvasScrollArea = document.getElementById('canvasScrollArea');
        const canvasWrapper = document.getElementById('canvasWrapper');

        if (!canvasScrollArea || !canvasWrapper) {
            console.error('Canvas containers not found');
            return { x: 0, y: 0 };
        }

        // Get scroll area bounding rectangle
        const scrollAreaRect = canvasScrollArea.getBoundingClientRect();

        // Convert screen coordinates to scroll area coordinates
        const scrollAreaX = screenX - scrollAreaRect.left;
        const scrollAreaY = screenY - scrollAreaRect.top;

        // Account for scroll position within the scroll area
        const scrollX = canvasScrollArea.scrollLeft;
        const scrollY = canvasScrollArea.scrollTop;

        // Get coordinates within the wrapper (accounting for scroll)
        const wrapperX = scrollAreaX + scrollX;
        const wrapperY = scrollAreaY + scrollY;

        // The canvas is flex-centered within the wrapper
        // Calculate where the canvas center is within the wrapper
        const wrapperWidth = canvasWrapper.offsetWidth;
        const wrapperHeight = canvasWrapper.offsetHeight;
        const canvasCenterInWrapperX = wrapperWidth / 2;
        const canvasCenterInWrapperY = wrapperHeight / 2;

        // Get coordinates relative to the canvas center (transform origin)
        const relativeX = wrapperX - canvasCenterInWrapperX;
        const relativeY = wrapperY - canvasCenterInWrapperY;

        // Since panX and panY should be 0 (we use scroll for panning), only reverse zoom
        // Canvas has CSS transform: scale(zoom) with center origin
        const unscaledX = relativeX / this.zoom;
        const unscaledY = relativeY / this.zoom;

        // Convert from transform origin (center) to canvas coordinates (top-left origin)
        const canvasX = unscaledX + this.canvasWidth / 2;
        const canvasY = unscaledY + this.canvasHeight / 2;

        return { x: canvasX, y: canvasY };
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
            document.getElementById('canvasBackgroundColor').value = this.canvasBackground;
            document.getElementById('frameRate').value = this.frameRate;
            document.getElementById('duration').value = this.duration;
        }
        // Initialize zoom display and center viewport
        this.updateZoomDisplay();
        this.centerViewportOnCanvas();
    }

    // Test method to add a text object for debugging
    addTestText() {
        this.createTextObject(100, 100, 'Test Text');
        console.log('Test text added at 100, 100');
    }

    setupKeyboardShortcuts() {
        // Add keyup listener for space bar temporary panning
        document.addEventListener('keyup', (e) => {
            // Prevent shortcuts when typing in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            if (e.key === ' ' && this.spacePanning) {
                // Space released - revert to previous tool
                this.spacePanning = false;
                this.setTool(this.previousTool);
                this.canvas.classList.remove('grabbing');
                const canvasScrollArea = document.getElementById('canvasScrollArea');
                if (canvasScrollArea) {
                    canvasScrollArea.classList.remove('panning');
                }
                // End any active panning
                if (this.panAnimationFrame) {
                    cancelAnimationFrame(this.panAnimationFrame);
                    this.panAnimationFrame = null;
                }
                this.panStartMouseX = undefined;
                this.panStartMouseY = undefined;
                this.panStartScrollX = undefined;
                this.panStartScrollY = undefined;
            }
        });

        document.addEventListener('keydown', (e) => {
            // Handle Escape key specially - it should work even in input fields
            if (e.key.toLowerCase() === 'escape') {
                e.preventDefault();

                // Close any open modals first
                this.closeAllModals();

                // If user is in a text field, just exit the field (don't unselect object)
                if (document.activeElement &&
                    (document.activeElement.tagName === 'INPUT' ||
                        document.activeElement.tagName === 'TEXTAREA')) {
                    document.activeElement.blur();
                    return; // Exit early - don't unselect object when exiting text field
                }

                // Only unselect objects if not exiting a text field
                if (this.selectedObject) {
                    this.selectedObject = null;
                    // Collapse all timeline layers when unselecting
                    this.textObjects.forEach(obj => obj._timelineExpanded = false);
                    if (this.timeline) {
                        this.timeline.updateLayers();
                    }
                    this.updateRightPanel();
                    this.redraw();
                }
                return;
            }

            // Handle zoom commands specially - they should work even in input fields to prevent browser zoom
            if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
                e.preventDefault();
                this.zoomIn();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '-') {
                e.preventDefault();
                this.zoomOut();
                return;
            }
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault();
                this.resetZoom();
                return;
            }

            // Prevent other shortcuts when typing in input fields
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
                    // Space bar for temporary panning (if not already panning)
                    if (!this.spacePanning && this.currentTool !== 'hand') {
                        this.spacePanning = true;
                        this.previousTool = this.currentTool;
                        this.setTool('hand');
                    }
                    break;
                case 'enter':
                    e.preventDefault();
                    // Enter key for play/pause
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
                case 'd':
                    if ((e.metaKey || e.ctrlKey) && this.selectedObject) {
                        e.preventDefault();
                        // Cmd+D: Duplicate selected object
                        const duplicated = this.duplicateObject(this.selectedObject);

                        // Add small offset for visual feedback
                        const offset = 20; // 20 pixels offset
                        const currentX = this.getPropertyValue(duplicated, 'x');
                        const currentY = this.getPropertyValue(duplicated, 'y');

                        // Update position for all keyframes to maintain offset
                        if (duplicated.keyframes.x) {
                            duplicated.keyframes.x.forEach(keyframe => {
                                keyframe.value += offset;
                            });
                        }
                        if (duplicated.keyframes.y) {
                            duplicated.keyframes.y.forEach(keyframe => {
                                keyframe.value += offset;
                            });
                        }

                        this.selectedObject = duplicated;
                        this.updateRightPanel();
                        this.redraw();
                        this.saveState();
                    }
                    break;
                case 'arrowleft':
                    if (this.selectedObject) {
                        // Handle object movement when object is selected
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const currentX = this.getPropertyValue(this.selectedObject, 'x');
                        this.updateObjectProperty(this.selectedObject, 'x', currentX - step);
                        this.redraw();
                        this.updateRightPanel();
                        this.saveState();
                    } else {
                        // Handle timeline navigation when no object is selected
                        e.preventDefault();
                        if (e.metaKey || e.ctrlKey) {
                            // Cmd+Left: Jump to first frame
                            this.goToStart();
                        } else if (e.shiftKey) {
                            this.jumpBackward(10);
                        } else {
                            this.stepBackward();
                        }
                    }
                    break;
                case 'arrowright':
                    if (this.selectedObject) {
                        // Handle object movement when object is selected
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const currentX = this.getPropertyValue(this.selectedObject, 'x');
                        this.updateObjectProperty(this.selectedObject, 'x', currentX + step);
                        this.redraw();
                        this.updateRightPanel();
                        this.saveState();
                    } else {
                        // Handle timeline navigation when no object is selected
                        e.preventDefault();
                        if (e.metaKey || e.ctrlKey) {
                            // Cmd+Right: Jump to last frame
                            this.goToEnd();
                        } else if (e.shiftKey) {
                            this.jumpForward(10);
                        } else {
                            this.stepForward();
                        }
                    }
                    break;
                case 'arrowup':
                    // Handle object movement when object is selected
                    if (this.selectedObject) {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const currentY = this.getPropertyValue(this.selectedObject, 'y');
                        this.updateObjectProperty(this.selectedObject, 'y', currentY - step);
                        this.redraw();
                        this.updateRightPanel();
                        this.saveState();
                    }
                    break;
                case 'arrowdown':
                    // Handle object movement when object is selected
                    if (this.selectedObject) {
                        e.preventDefault();
                        const step = e.shiftKey ? 10 : 1;
                        const currentY = this.getPropertyValue(this.selectedObject, 'y');
                        this.updateObjectProperty(this.selectedObject, 'y', currentY + step);
                        this.redraw();
                        this.updateRightPanel();
                        this.saveState();
                    }
                    break;
                case 'e':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+E: Export video
                        this.exportVideo();
                    }
                    break;
                case 'f':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+F: Upload fonts
                        document.getElementById('fontUpload').click();
                    }
                    break;
                case 'n':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+N: New document
                        this.newProject();
                    }
                    break;
                case 'o':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+O: Open document
                        this.openProject();
                    }
                    break;
                case 's':
                    if (e.metaKey || e.ctrlKey) {
                        e.preventDefault();
                        // Cmd+S: Save document
                        this.saveProject();
                    }
                    break;
            }
        });
    }

    setTool(tool) {
        // Track previous tool (but not when space panning)
        if (!this.spacePanning && tool !== this.currentTool) {
            this.previousTool = this.currentTool;
        }

        this.currentTool = tool;

        // Update UI (but not when space panning to avoid visual flicker)
        if (!this.spacePanning) {
            document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
            document.getElementById(tool + 'Tool').classList.add('active');
        }

        // Update cursor classes
        this.canvas.className = this.canvas.className.replace(/\b\w+-cursor\b/g, '');
        this.canvas.classList.add(tool + '-cursor');
    }

    // Helper function to get current property value for a text object
    getPropertyValue(textObject, property, frame = this.currentFrame) {
        // Check for temporary values first (used during slider dragging)
        if (textObject._tempValues && textObject._tempValues.hasOwnProperty(property)) {
            return textObject._tempValues[property];
        }

        const keyframes = textObject.keyframes[property];
        if (!keyframes || keyframes.length === 0) {
            // Return default values for properties without keyframes
            const defaults = {
                x: 0, y: 0, fontSize: 48, color: '#000000'
            };

            // For variable axes, try to get the default from font info
            if (property.startsWith('variableaxis:')) {
                const axisTag = property.replace('variableaxis:', '');
                if (this.fonts.has(textObject.fontFamily)) {
                    const fontInfo = this.fonts.get(textObject.fontFamily);
                    const axisInfo = fontInfo.variableAxes[axisTag];
                    if (axisInfo) {
                        return axisInfo.default;
                    }
                }
                return 0;
            }

            return defaults[property] || 0;
        }

        // Find keyframes around the current frame
        let beforeKeyframe = null;
        let afterKeyframe = null;

        for (let i = 0; i < keyframes.length; i++) {
            const kf = keyframes[i];
            if (kf.frame <= frame) {
                beforeKeyframe = kf;
            }
            if (kf.frame >= frame && !afterKeyframe) {
                afterKeyframe = kf;
                break;
            }
        }

        // If we're exactly on a keyframe, return its value
        if (beforeKeyframe && beforeKeyframe.frame === frame) {
            return beforeKeyframe.value;
        }

        // If we only have a before keyframe, use its value
        if (beforeKeyframe && !afterKeyframe) {
            return beforeKeyframe.value;
        }

        // If we only have an after keyframe, use its value
        if (!beforeKeyframe && afterKeyframe) {
            return afterKeyframe.value;
        }

        // Interpolate between keyframes
        if (beforeKeyframe && afterKeyframe) {
            let progress = (frame - beforeKeyframe.frame) / (afterKeyframe.frame - beforeKeyframe.frame);

            // Apply Bezier curve if present on the beforeKeyframe
            if (beforeKeyframe.curve) {
                progress = this.evaluateBezierCurve(progress, beforeKeyframe.curve);
            }

            if (property === 'color') {
                // Color interpolation
                return this.interpolateColor(beforeKeyframe.value, afterKeyframe.value, progress);
            } else {
                // Numeric interpolation
                return beforeKeyframe.value + (afterKeyframe.value - beforeKeyframe.value) * progress;
            }
        }

        return 0;
    }

    // Helper function to set a keyframe for a property
    setKeyframe(textObject, property, frame, value) {
        if (!textObject.keyframes[property]) {
            textObject.keyframes[property] = [];
        }

        const keyframes = textObject.keyframes[property];

        // Check if keyframe already exists at this frame
        const existingIndex = keyframes.findIndex(kf => kf.frame === frame);

        if (existingIndex >= 0) {
            // Update existing keyframe
            keyframes[existingIndex].value = value;
            return false; // Existing keyframe updated
        } else {
            // Add new keyframe and sort by frame
            keyframes.push({ frame, value });
            keyframes.sort((a, b) => a.frame - b.frame);
            return true; // New keyframe created
        }
    }

    // Helper function to remove a keyframe
    removeKeyframe(textObject, property, frame) {
        if (!textObject.keyframes[property]) return;

        const keyframes = textObject.keyframes[property];
        const index = keyframes.findIndex(kf => kf.frame === frame);

        if (index >= 0) {
            keyframes.splice(index, 1);

            // Remove property array if empty
            if (keyframes.length === 0) {
                delete textObject.keyframes[property];
            }
        }
    }

    // Helper function to check if a keyframe exists
    hasKeyframe(textObject, property, frame) {
        const keyframes = textObject.keyframes[property];
        return keyframes && keyframes.some(kf => kf.frame === frame);
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
            text: text,
            fontFamily: defaultFont,
            textAlign: 'left',
            openTypeFeatures: {},
            keyframes: {
                x: [{ frame: this.currentFrame, value: x }],
                y: [{ frame: this.currentFrame, value: y }]
            }
        };

        this.textObjects.push(textObject);
        this.selectedObject = textObject;

        this.updateTimeline();
        this.updateRightPanel();
        this.redraw();
        this.saveState();
    }

    selectObjectAt(x, y) {
        const previousSelection = this.selectedObject;
        this.selectedObject = null;

        for (let i = this.textObjects.length - 1; i >= 0; i--) {
            const obj = this.textObjects[i];
            const props = this.getObjectPropertiesAtFrame(obj, this.currentFrame);

            // Measure text with accurate font features applied
            const metrics = this.measureTextWithFeatures(obj, props);
            const bounds = this.getTextBounds(props, metrics, obj.textAlign);

            if (x >= bounds.left && x <= bounds.right &&
                y >= bounds.top && y <= bounds.bottom) {
                this.selectedObject = obj;
                break;
            }
        }

        // Handle timeline expansion based on selection
        if (previousSelection !== this.selectedObject) {
            // Collapse previously selected object if it's different
            if (previousSelection) {
                previousSelection._timelineExpanded = false;
            }

            // Expand newly selected object
            if (this.selectedObject) {
                this.selectedObject._timelineExpanded = true;
            }

            // Update timeline to reflect changes
            if (this.timeline) {
                this.timeline.updateLayers();
            }
        }

        this.updateRightPanel();
        this.redraw();
        return this.selectedObject;
    }

    measureTextWithFeatures(textObject, props) {
        // Create temporary canvas for accurate text measurement with font features
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');

        // Add canvas to DOM temporarily for CSS font features to work
        tempCanvas.style.position = 'absolute';
        tempCanvas.style.left = '-9999px';
        tempCanvas.style.top = '-9999px';
        tempCanvas.style.visibility = 'hidden';
        document.body.appendChild(tempCanvas);

        try {
            // Check if font is available and apply features
            const fontAvailable = this.fonts.has(textObject.fontFamily) && this.isFontLoaded(textObject.fontFamily);

            if (fontAvailable) {
                // Apply variable font axes and/or OpenType features if available
                const hasVariableAxes = props.variableAxes && Object.keys(props.variableAxes).length > 0;
                const hasOpenTypeFeatures = props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0;

                if (hasVariableAxes || hasOpenTypeFeatures) {
                    // Apply font features to the temporary canvas
                    this.applyFontFeaturesToTempCanvas(tempCanvas, textObject.fontFamily, props.fontSize, props.variableAxes, props.openTypeFeatures);
                } else {
                    // Use basic font setting
                    tempCtx.font = `${props.fontSize}px "${textObject.fontFamily}"`;
                }
            } else {
                // Use fallback font
                tempCtx.font = `${props.fontSize}px Arial, sans-serif`;
            }

            // Measure the text with the applied features
            const metrics = tempCtx.measureText(textObject.text);
            return metrics;

        } finally {
            // Clean up the temporary canvas
            if (tempCanvas.parentNode) {
                document.body.removeChild(tempCanvas);
            }
        }
    }

    getAccurateTextBounds(obj, frame = null) {
        // Get properties for the specified frame (or current frame if not specified)
        const frameToUse = frame !== null ? frame : this.currentFrame;
        const props = this.getObjectPropertiesAtFrame(obj, frameToUse);

        // Measure text with accurate font features applied
        const metrics = this.measureTextWithFeatures(obj, props);

        // Return accurate bounds
        return this.getTextBounds(props, metrics, obj.textAlign);
    }

    applyFontFeaturesToTempCanvas(canvas, fontFamily, fontSize, variableAxes = {}, openTypeFeatures = {}) {
        try {
            const context = canvas.getContext('2d');

            // Store original styles for cleanup
            const originalFontFamily = canvas.style.fontFamily;
            const originalFontVariationSettings = canvas.style.fontVariationSettings;
            const originalFontFeatureSettings = canvas.style.fontFeatureSettings;

            // Create font-variation-settings string
            let fontVariationSettings = '';
            if (variableAxes && Object.keys(variableAxes).length > 0) {
                Object.entries(variableAxes).forEach(([tag, value]) => {
                    fontVariationSettings += `"${tag}" ${value}, `;
                });
                fontVariationSettings = fontVariationSettings.replace(/, $/, '');
            }

            // Create font-feature-settings string
            let fontFeatureSettings = '';
            if (openTypeFeatures && Object.keys(openTypeFeatures).length > 0) {
                Object.entries(openTypeFeatures).forEach(([tag, enabled]) => {
                    if (enabled) {
                        fontFeatureSettings += `"${tag}" 1, `;
                    }
                });
                fontFeatureSettings = fontFeatureSettings.replace(/, $/, '');
            }

            // Apply font settings to the canvas element
            canvas.style.fontFamily = `"${fontFamily}"`;
            if (fontVariationSettings) {
                canvas.style.fontVariationSettings = fontVariationSettings;
            }
            if (fontFeatureSettings) {
                canvas.style.fontFeatureSettings = fontFeatureSettings;
            }
            canvas.style.fontSize = `${fontSize}px`;

            // Set the context font
            context.font = `${fontSize}px "${fontFamily}"`;

        } catch (error) {
            console.warn('Failed to apply font features to temp canvas:', error);
            // Fallback to basic font
            const context = canvas.getContext('2d');
            context.font = `${fontSize}px "${fontFamily}"`;
        }
    }

    getTextBounds(props, metrics, textAlign = 'left') {
        const padding = 5;
        let left, right;

        switch (textAlign) {
            case 'center':
                left = props.x - metrics.width / 2 - padding;
                right = props.x + metrics.width / 2 + padding;
                break;
            case 'right':
                left = props.x - metrics.width - padding;
                right = props.x + padding;
                break;
            case 'left':
            default:
                left = props.x - padding;
                right = props.x + metrics.width + padding;
                break;
        }

        return {
            left: left,
            top: props.y - padding,
            right: right,
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

        // Set or update keyframe for this property at current frame
        const wasNewKeyframe = this.setKeyframe(obj, property, this.currentFrame, value);

        // Update timeline and UI only when new keyframes are created
        if (wasNewKeyframe) {
            if (this.timeline) {
                this.timeline.update();
            }
            this.updateRightPanel(); // Update keyframe button states
        }

        console.log('Object keyframes:', obj.keyframes);
    }

    zoomAt(x, y, factor) {
        const oldZoom = this.zoom;

        // Use step-based zooming even for cursor zoom
        if (factor > 1) {
            this.zoomIn();
        } else {
            this.zoomOut();
        }

        // If zoom changed, update the transform
        if (this.zoom !== oldZoom) {
            this.updateCanvasTransform();
        }
    }

    redraw() {
        // Increment redraw counter for debugging
        this._redrawCount = (this._redrawCount || 0) + 1;
        console.log(`Redraw #${this._redrawCount} started`);

        // Clear the canvas completely
        this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Clear any cached canvas styles to ensure fresh rendering
        const canvas = this.ctx.canvas;
        if (this._originalCanvasStyles) {
            canvas.style.fontFamily = this._originalCanvasStyles.fontFamily || '';
            canvas.style.fontVariationSettings = this._originalCanvasStyles.fontVariationSettings || '';
            canvas.style.fontFeatureSettings = this._originalCanvasStyles.fontFeatureSettings || '';
            canvas.style.fontSize = '';
            delete this._originalCanvasStyles;
        }

        // Draw text objects
        this.textObjects.forEach((obj, index) => {
            console.log(`Drawing text object ${index}: "${obj.text}"`);
            this.drawTextObject(obj);
        });

        // Draw selection highlight
        if (this.selectedObject) {
            this.drawSelection(this.selectedObject);
        }

        console.log(`Redraw #${this._redrawCount} completed`);
    }

    drawTextObject(obj) {
        this.ctx.save();

        const props = this.getObjectPropertiesAtFrame(obj, this.currentFrame);

        console.log('Drawing text object at frame', this.currentFrame, 'with props:', {
            x: props.x,
            y: props.y,
            fontSize: props.fontSize,
            color: props.color,
            variableAxes: props.variableAxes,
            openTypeFeatures: props.openTypeFeatures
        });

        console.log('Text object OpenType features:', obj.openTypeFeatures);
        console.log('Props OpenType features:', props.openTypeFeatures);

        // Check if font is available in both our font map and document.fonts
        const fontAvailable = this.fonts.has(obj.fontFamily) && this.isFontLoaded(obj.fontFamily);

        let fontString;
        if (fontAvailable) {
            fontString = `${props.fontSize}px "${obj.fontFamily}"`;

            // Apply variable font axes and/or OpenType features if available
            const hasVariableAxes = props.variableAxes && Object.keys(props.variableAxes).length > 0;
            const hasOpenTypeFeatures = props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0;

            console.log(`Font features check for "${obj.text}":`, {
                hasVariableAxes,
                hasOpenTypeFeatures,
                variableAxes: props.variableAxes,
                openTypeFeatures: props.openTypeFeatures
            });

            if (hasVariableAxes || hasOpenTypeFeatures) {
                console.log(`Applying font features to "${obj.text}":`, {
                    variableAxes: props.variableAxes,
                    openTypeFeatures: props.openTypeFeatures
                });
                this.applyFontFeaturesToCanvas(obj.fontFamily, props.fontSize, props.variableAxes, props.openTypeFeatures);
            } else {
                console.log(`No font features for "${obj.text}", using basic font`);
                this.ctx.font = fontString;
            }
        } else {
            // Use fallback font when the desired font is not available
            fontString = `${props.fontSize}px Arial, sans-serif`;
            this.ctx.font = fontString;
        }
        // Add visual debugging: slightly modify color when OpenType features are active
        let fillColor = props.color;
        const hasActiveOpenTypeFeatures = props.openTypeFeatures &&
            Object.values(props.openTypeFeatures).some(enabled => enabled);

        if (hasActiveOpenTypeFeatures) {
            // Add a slight blue tint to indicate OpenType features are active
            // This is just for debugging - can be removed later
            const r = parseInt(fillColor.slice(1, 3), 16);
            const g = parseInt(fillColor.slice(3, 5), 16);
            const b = Math.min(255, parseInt(fillColor.slice(5, 7), 16) + 50);
            fillColor = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
            console.log(`OpenType features active - Color changed from ${props.color} to ${fillColor}`);
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.textBaseline = 'top';
        this.ctx.textAlign = obj.textAlign || 'left';

        // Render text with OpenType features if needed
        if (this._pendingOpenTypeFeatures) {
            this.renderTextWithOpenTypeFeatures(obj.text, props.x, props.y, this._pendingOpenTypeFeatures);
            delete this._pendingOpenTypeFeatures;
        } else {
            this.ctx.fillText(obj.text, props.x, props.y);
        }

        // Clean up canvas styles if variable axes were applied
        if (this._originalCanvasStyles) {
            const canvas = this.ctx.canvas;
            canvas.style.fontFamily = this._originalCanvasStyles.fontFamily || '';
            canvas.style.fontVariationSettings = this._originalCanvasStyles.fontVariationSettings || '';
            canvas.style.fontSize = '';
            delete this._originalCanvasStyles;
        }

        this.ctx.restore();
    }

    // Render text with OpenType features using enhanced canvas approach
    renderTextWithOpenTypeFeatures(text, x, y, featureSettings) {
        try {
            console.log('Rendering text with OpenType features:', featureSettings);

            // Try the canvas CSS approach with forced repaint
            const canvas = this.ctx.canvas;
            const originalFontFeatureSettings = canvas.style.fontFeatureSettings;

            // Apply features to canvas element
            canvas.style.fontFeatureSettings = featureSettings.fontFeatureSettings;

            // Force a layout reflow to ensure styles are applied
            canvas.offsetHeight;

            // Re-apply font to context after style application
            this.ctx.font = `${featureSettings.fontSize}px "${featureSettings.fontFamily}"`;

            console.log(`Applied canvas font-feature-settings: "${canvas.style.fontFeatureSettings}"`);
            console.log(`Canvas context font: "${this.ctx.font}"`);

            // Render text
            this.ctx.fillText(text, x, y);

            // Restore canvas styles
            canvas.style.fontFeatureSettings = originalFontFeatureSettings;

            console.log('OpenType text rendering completed (canvas CSS method)');

        } catch (error) {
            console.warn('Failed to render text with OpenType features:', error);
            // Fallback to regular text rendering
            this.ctx.fillText(text, x, y);
        }
    }    // Apply font features (variable axes and OpenType features) to canvas context
    applyFontFeaturesToCanvas(fontFamily, fontSize, variableAxes = {}, openTypeFeatures = {}) {
        try {
            const hasVariableAxes = variableAxes && Object.keys(variableAxes).length > 0;
            const hasOpenTypeFeatures = openTypeFeatures && Object.keys(openTypeFeatures).length > 0;

            console.log('Applying font features:', {
                fontFamily,
                fontSize,
                variableAxes,
                openTypeFeatures,
                hasVariableAxes,
                hasOpenTypeFeatures
            });

            // For variable axes, we can use the canvas element CSS approach
            if (hasVariableAxes) {
                this.applyVariableAxesToCanvas(fontFamily, fontSize, variableAxes);
            }

            // For OpenType features, we need to use DOM-based rendering
            if (hasOpenTypeFeatures) {
                this.applyOpenTypeFeaturesToCanvas(fontFamily, fontSize, openTypeFeatures);
            }

            // If only variable axes, set basic font
            if (hasVariableAxes && !hasOpenTypeFeatures) {
                this.ctx.font = `${fontSize}px "${fontFamily}"`;
            }

        } catch (error) {
            console.warn('Failed to apply font features to canvas:', error);
            // Fallback to basic font
            this.ctx.font = `${fontSize}px "${fontFamily}"`;
        }
    }

    // Apply variable axes using canvas element CSS (this works reliably)
    applyVariableAxesToCanvas(fontFamily, fontSize, variableAxes) {
        const canvas = this.ctx.canvas;
        const originalFontFamily = canvas.style.fontFamily;
        const originalFontVariationSettings = canvas.style.fontVariationSettings;

        // Create font-variation-settings string
        let fontVariationSettings = '';
        Object.entries(variableAxes).forEach(([tag, value]) => {
            fontVariationSettings += `"${tag}" ${value}, `;
        });
        fontVariationSettings = fontVariationSettings.replace(/, $/, '');

        console.log(`Applying variable axes: ${fontVariationSettings}`);

        // Apply to canvas element
        canvas.style.fontFamily = `"${fontFamily}"`;
        canvas.style.fontVariationSettings = fontVariationSettings;
        canvas.style.fontSize = `${fontSize}px`;

        // Store for cleanup
        this._originalCanvasStyles = {
            fontFamily: originalFontFamily,
            fontVariationSettings: originalFontVariationSettings
        };
    }

    // Apply OpenType features using DOM-based rendering (more reliable for features)
    applyOpenTypeFeaturesToCanvas(fontFamily, fontSize, openTypeFeatures) {
        // Create font-feature-settings string
        let fontFeatureSettings = '';
        Object.entries(openTypeFeatures).forEach(([tag, enabled]) => {
            if (enabled) {
                fontFeatureSettings += `"${tag}" 1, `;
            }
        });
        fontFeatureSettings = fontFeatureSettings.replace(/, $/, '');

        console.log(`Applying OpenType features: ${fontFeatureSettings}`);

        // Store feature settings for use during text rendering
        this._pendingOpenTypeFeatures = {
            fontFamily,
            fontSize,
            fontFeatureSettings
        };

        // Set basic font for now - actual rendering will use DOM approach
        this.ctx.font = `${fontSize}px "${fontFamily}"`;
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

        // Measure text with accurate font features applied
        const metrics = this.measureTextWithFeatures(obj, props);

        this.ctx.save();
        this.ctx.strokeStyle = '#0078d4';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([8, 4]);

        const bounds = this.getTextBounds(props, metrics, obj.textAlign);
        this.ctx.strokeRect(bounds.left, bounds.top,
            bounds.right - bounds.left, bounds.bottom - bounds.top);

        // Draw position origin mark
        this.ctx.setLineDash([]);
        this.ctx.strokeStyle = '#ff4444';
        this.ctx.fillStyle = '#ff4444';
        this.ctx.lineWidth = 2;

        // Draw crosshair at origin position
        const crossSize = 8;
        this.ctx.beginPath();
        // Horizontal line
        this.ctx.moveTo(props.x - crossSize, props.y);
        this.ctx.lineTo(props.x + crossSize, props.y);
        // Vertical line
        this.ctx.moveTo(props.x, props.y - crossSize);
        this.ctx.lineTo(props.x, props.y + crossSize);
        this.ctx.stroke();

        // Draw small circle at center
        this.ctx.beginPath();
        this.ctx.arc(props.x, props.y, 3, 0, 2 * Math.PI);
        this.ctx.fill();

        this.ctx.restore();
    }

    getObjectPropertiesAtFrame(obj, frame) {
        const props = {
            x: this.getPropertyValue(obj, 'x', frame),
            y: this.getPropertyValue(obj, 'y', frame),
            fontSize: this.getPropertyValue(obj, 'fontSize', frame),
            color: this.getPropertyValue(obj, 'color', frame),
            variableAxes: {},
            openTypeFeatures: obj.openTypeFeatures || {}
        };

        // Add variable font axes
        Object.keys(obj.keyframes).forEach(property => {
            if (property.startsWith('variableaxis:')) {
                // This is a variable font axis - extract the axis tag
                const axisTag = property.replace('variableaxis:', '');
                props.variableAxes[axisTag] = this.getPropertyValue(obj, property, frame);
            }
        });

        return props;
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
        // Handle edge cases
        if (t <= 0) return 0;
        if (t >= 1) return 1;

        // Cubic bezier curve evaluation for timing functions
        // P0 = (0,0), P1 = (x1, y1), P2 = (x2, y2), P3 = (1,1)
        const x1 = curve.x1;
        const y1 = curve.y1;
        const x2 = curve.x2;
        const y2 = curve.y2;

        // Use a more robust method: binary search followed by Newton-Raphson refinement
        let paramT = this.solveBezierX(t, x1, x2);

        // Now calculate Y with the solved parameter
        return this.bezierY(paramT, y1, y2);
    }

    solveBezierX(x, x1, x2) {
        // Binary search for initial guess
        let t0 = 0;
        let t1 = 1;
        let t = x; // Start with linear approximation

        // Binary search to get close
        for (let i = 0; i < 8; i++) {
            const currentX = this.bezierX(t, x1, x2);
            if (Math.abs(currentX - x) < 0.0001) break;

            if (currentX < x) {
                t0 = t;
            } else {
                t1 = t;
            }
            t = (t0 + t1) / 2;
        }

        // Newton-Raphson refinement
        for (let i = 0; i < 4; i++) {
            const currentX = this.bezierX(t, x1, x2);
            const dx = currentX - x;
            if (Math.abs(dx) < 0.0001) break;

            const derivative = this.bezierXDerivative(t, x1, x2);
            if (Math.abs(derivative) < 0.0001) break;

            const newT = t - dx / derivative;
            // Clamp to valid range
            t = Math.max(0, Math.min(1, newT));
        }

        return t;
    }

    bezierX(t, x1, x2) {
        // Cubic bezier X coordinate: 3(1-t)²t*x1 + 3(1-t)t²*x2 + t³
        const mt = 1 - t;
        return 3 * mt * mt * t * x1 + 3 * mt * t * t * x2 + t * t * t;
    }

    bezierY(t, y1, y2) {
        // Cubic bezier Y coordinate: 3(1-t)²t*y1 + 3(1-t)t²*y2 + t³
        const mt = 1 - t;
        return 3 * mt * mt * t * y1 + 3 * mt * t * t * y2 + t * t * t;
    }

    bezierXDerivative(t, x1, x2) {
        // Derivative of bezier X coordinate
        // d/dt [3(1-t)²t*x1 + 3(1-t)t²*x2 + t³]
        // = 3x1(1-t)² - 6x1(1-t)t + 6x2(1-t)t - 3x2t² + 3t²
        // = 3x1(1-t)² + 3t(2x2(1-t) - 2x1(1-t) - x2t + t)
        // = 3x1(1-t)² + 3t((2x2 - 2x1)(1-t) + t(1 - x2))
        const mt = 1 - t;
        return 3 * x1 * mt * mt + 6 * (x2 - x1) * mt * t + 3 * (1 - x2) * t * t;
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
            // Store current selection to preserve it
            const currentSelection = this.selectedObject;
            this.historyIndex--;
            this.loadState(this.history[this.historyIndex]);
            // Restore selection after loading state
            this.restoreSelection(currentSelection);
        }
    }

    redo() {
        if (this.historyIndex < this.history.length - 1) {
            // Store current selection to preserve it
            const currentSelection = this.selectedObject;
            this.historyIndex++;
            this.loadState(this.history[this.historyIndex]);
            // Restore selection after loading state
            this.restoreSelection(currentSelection);
        }
    }

    loadState(state) {
        this.textObjects = JSON.parse(JSON.stringify(state.textObjects));
        this.setCurrentFrame(state.currentFrame);
        this.canvasWidth = state.canvasWidth;
        this.canvasHeight = state.canvasHeight;
        this.canvasBackground = state.canvasBackground || '#ffffff';
        this.frameRate = state.frameRate;
        this.duration = state.duration;

        // Update UI
        document.getElementById('canvasWidth').value = this.canvasWidth;
        document.getElementById('canvasHeight').value = this.canvasHeight;
        document.getElementById('canvasBackgroundColor').value = this.canvasBackground;
        document.getElementById('frameRate').value = this.frameRate;
        document.getElementById('duration').value = this.duration;

        this.updateCanvasSize();
        this.updateTimeline();
        this.redraw();

        // Update the right panel
        if (window.UIManager) {
            window.UIManager.updateRightPanel(this);
        }
    }

    restoreSelection(previousSelection) {
        // Try to restore the selection by finding the object with the same ID
        if (previousSelection && previousSelection.id) {
            const matchingObject = this.textObjects.find(obj => obj.id === previousSelection.id);
            if (matchingObject) {
                this.selectedObject = matchingObject;
                // Clear all timeline expansion states first
                this.textObjects.forEach(obj => obj._timelineExpanded = false);
                // Update timeline to reflect the restored selection
                if (this.selectedObject) {
                    this.selectedObject._timelineExpanded = true;
                }
                if (this.timeline) {
                    this.timeline.updateLayers();
                }
                this.updateRightPanel();
                this.redraw();
            } else {
                // Object no longer exists, clear selection
                this.selectedObject = null;
                // Clear all timeline expansion states
                this.textObjects.forEach(obj => obj._timelineExpanded = false);
                if (this.timeline) {
                    this.timeline.updateLayers();
                }
                this.updateRightPanel();
                this.redraw();
            }
        } else {
            // No previous selection, clear selection
            this.selectedObject = null;
            // Clear all timeline expansion states
            this.textObjects.forEach(obj => obj._timelineExpanded = false);
            if (this.timeline) {
                this.timeline.updateLayers();
            }
            this.updateRightPanel();
            this.redraw();
        }
    }

    // Placeholder methods to be implemented in other files
    setupTimeline() {
        if (window.TimelineManager) {
            this.timeline = new TimelineManager(this);
        }
    }

    setupTimelineDivider() {
        const divider = document.getElementById('timelineDivider');
        const timeline = document.getElementById('timeline');
        const mainContent = document.getElementById('mainContent');

        if (!divider || !timeline || !mainContent) {
            console.warn('Timeline divider elements not found');
            return;
        }

        let isDragging = false;
        let startY = 0;
        let startTimelineHeight = 0;

        const startDrag = (e) => {
            isDragging = true;
            startY = e.clientY;
            startTimelineHeight = parseInt(getComputedStyle(timeline).height);
            divider.classList.add('dragging');
            document.body.style.cursor = 'ns-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        };

        const doDrag = (e) => {
            if (!isDragging) return;

            const deltaY = startY - e.clientY; // Inverted because timeline is at bottom
            const newHeight = Math.max(100, Math.min(600, startTimelineHeight + deltaY));

            timeline.style.height = newHeight + 'px';
            e.preventDefault();
        };

        const stopDrag = () => {
            if (isDragging) {
                isDragging = false;
                divider.classList.remove('dragging');
                document.body.style.cursor = '';
                document.body.style.userSelect = '';

                // Save the new timeline height to settings
                const newHeight = parseInt(getComputedStyle(timeline).height);
                if (window.AppSettings) {
                    window.AppSettings.set('timelineHeight', newHeight);
                }
            }
        };

        // Mouse events
        divider.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);

        // Touch events for mobile
        divider.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            startDrag({ clientY: touch.clientY, preventDefault: () => e.preventDefault() });
        });

        document.addEventListener('touchmove', (e) => {
            if (isDragging && e.touches.length > 0) {
                const touch = e.touches[0];
                doDrag({ clientY: touch.clientY, preventDefault: () => e.preventDefault() });
            }
        });

        document.addEventListener('touchend', stopDrag);

        // Load saved timeline height
        if (window.AppSettings) {
            const savedHeight = window.AppSettings.getValue('timelineHeight');
            if (savedHeight && savedHeight !== 220) { // Only apply if different from default
                timeline.style.height = savedHeight + 'px';
            }
        }
    }

    updateTimeline() {
        if (this.timeline) {
            this.timeline.update();
        }
    }

    setCurrentFrame(frame) {
        console.log(`setCurrentFrame called: ${this.currentFrame} → ${frame}`);
        this.currentFrame = frame;
        if (this.timeline) {
            this.timeline.updateCursor();
        }
        this.updateFrameTimeDisplay();
        this.updateRightPanel();
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

    closeAllModals() {
        // Close all visible modals
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (modal.style.display === 'flex' || modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });

        // Also trigger any specific modal cleanup if needed
        // For export modal, we need to resolve the promise to prevent hanging
        if (window.currentExportPromise) {
            window.currentExportPromise.resolve(null);
            window.currentExportPromise = null;
        }
    }

    showAboutModal() {
        const modal = document.getElementById('aboutModal');
        if (modal) {
            modal.style.display = 'flex';
        }
    }

    newProject() {
        this.textObjects = [];
        this.selectedObject = null;
        this.setCurrentFrame(0);
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
        document.getElementById('canvasBackgroundColor').value = this.canvasBackground;
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

        // Migrate old variable axis format to new prefixed format
        this.textObjects.forEach(textObject => {
            const newKeyframes = {};
            Object.keys(textObject.keyframes || {}).forEach(property => {
                if (['x', 'y', 'fontSize', 'color'].includes(property)) {
                    // Keep standard properties as-is
                    newKeyframes[property] = textObject.keyframes[property];
                } else if (!property.startsWith('variableaxis:')) {
                    // This looks like an old variable axis - add prefix
                    newKeyframes[`variableaxis:${property}`] = textObject.keyframes[property];
                } else {
                    // Already has prefix - keep as-is
                    newKeyframes[property] = textObject.keyframes[property];
                }
            });
            textObject.keyframes = newKeyframes;
        });

        if (project.settings) {
            this.canvasWidth = project.settings.canvasWidth;
            this.canvasHeight = project.settings.canvasHeight;
            this.canvasBackground = project.settings.canvasBackground || '#ffffff';
            this.frameRate = project.settings.frameRate;
            this.duration = project.settings.duration;
        }

        this.selectedObject = null;
        this.setCurrentFrame(0);
        this.history = [];
        this.historyIndex = -1;

        // Update UI
        document.getElementById('canvasWidth').value = this.canvasWidth;
        document.getElementById('canvasHeight').value = this.canvasHeight;
        document.getElementById('canvasBackgroundColor').value = this.canvasBackground;
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