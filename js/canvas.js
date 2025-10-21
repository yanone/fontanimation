// Enhanced canvas management with improved rendering and background handling
class CanvasManager {
    constructor(app) {
        this.app = app;
        this.canvas = null;
        this.context = null;
        this.backgroundPattern = null;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.renderingQuality = 'high';

        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.canvas = document.getElementById('canvas');
        if (!this.canvas) {
            console.error('Canvas element not found');
            return;
        }

        this.context = this.canvas.getContext('2d');
        this.updateCanvasSize();
        this.setupHighDPICanvas();
        this.setupRenderingSettings();
    }

    setupHighDPICanvas() {
        const rect = this.canvas.getBoundingClientRect();

        // Set actual size in memory (scaled to account for extra pixel density)
        this.canvas.width = this.app.canvasWidth * this.devicePixelRatio;
        this.canvas.height = this.app.canvasHeight * this.devicePixelRatio;

        // Scale the canvas down using CSS
        this.canvas.style.width = this.app.canvasWidth + 'px';
        this.canvas.style.height = this.app.canvasHeight + 'px';

        // Scale the drawing context so everything draws at the correct size
        this.context.scale(this.devicePixelRatio, this.devicePixelRatio);
    }

    setupRenderingSettings() {
        // Enable high-quality text rendering
        this.context.textRenderingOptimization = 'optimizeQuality';
        this.context.imageSmoothingEnabled = true;
        this.context.imageSmoothingQuality = 'high';

        // Set text baseline for consistent positioning
        this.context.textBaseline = 'top';
        this.context.textAlign = 'left';
    }

    setupEventListeners() {
        if (!this.canvas) return;

        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // Touch events for mobile support
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // Keyboard events for precision
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        // Context menu prevention
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

        // Resize observer for responsive behavior
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(this.handleResize.bind(this));
            this.resizeObserver.observe(this.canvas.parentElement);
        }
    }

    updateCanvasSize() {
        if (!this.canvas) return;

        this.canvas.width = this.app.canvasWidth;
        this.canvas.height = this.app.canvasHeight;
        this.canvas.style.width = this.app.canvasWidth + 'px';
        this.canvas.style.height = this.app.canvasHeight + 'px';

        if (this.context) {
            this.setupRenderingSettings();
        }

        this.render();
    }

    setCanvasBackground(color) {
        this.app.canvasBackground = color;
        this.render();
    }

    getMousePosition(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (event.clientX - rect.left) * scaleX / this.devicePixelRatio,
            y: (event.clientY - rect.top) * scaleY / this.devicePixelRatio
        };
    }

    getTouchPosition(touch) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        return {
            x: (touch.clientX - rect.left) * scaleX / this.devicePixelRatio,
            y: (touch.clientY - rect.top) * scaleY / this.devicePixelRatio
        };
    }

    handleMouseDown(event) {
        const pos = this.getMousePosition(event);

        if (this.app.currentTool === 'select') {
            this.handleSelectStart(pos, event);
        } else if (this.app.currentTool === 'text') {
            this.handleTextPlacement(pos);
        } else if (this.app.currentTool === 'hand') {
            this.handlePanStart(event);
        } else if (this.app.currentTool === 'move') {
            this.handleMoveStart(pos);
        } else if (this.app.currentTool === 'rotate') {
            this.handleRotateStart(pos);
        } else if (this.app.currentTool === 'scale') {
            this.handleScaleStart(pos);
        }

        this.isDragging = true;
        this.lastMousePos = pos;
    }

    handleMouseMove(event) {
        const pos = this.getMousePosition(event);

        if (this.isDragging) {
            if (this.app.currentTool === 'select' && this.app.selectedObject) {
                this.handleObjectDrag(pos, event);
            } else if (this.app.currentTool === 'hand') {
                this.handlePanDrag(event);
            } else if (this.app.currentTool === 'move' && this.app.selectedObject) {
                this.handleObjectMove(pos, event);
            } else if (this.app.currentTool === 'rotate' && this.app.selectedObject) {
                this.handleObjectRotate(pos);
            } else if (this.app.currentTool === 'scale' && this.app.selectedObject) {
                this.handleObjectScale(pos);
            }
        } else {
            // Update cursor based on hover state
            this.updateCursor(pos);
        }

        this.lastMousePos = pos;
    }

    handleMouseUp(event) {
        this.isDragging = false;

        if (this.app.currentTool === 'select') {
            this.finalizeSelection();
        } else if (this.app.currentTool === 'hand') {
            this.handlePanEnd();
        }

        // Update timeline if object was modified
        if (this.objectWasModified) {
            if (this.app.timeline) {
                this.app.timeline.update();
            }
            this.objectWasModified = false;
        }
    }

    handleMouseLeave(event) {
        this.isDragging = false;

        if (this.app.currentTool === 'hand') {
            this.handlePanEnd();
        }
    }

    handleTouchStart(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseDown(mouseEvent);
        }
    }

    handleTouchMove(event) {
        event.preventDefault();
        if (event.touches.length === 1) {
            const touch = event.touches[0];
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.handleMouseMove(mouseEvent);
        }
    }

    handleTouchEnd(event) {
        event.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {});
        this.handleMouseUp(mouseEvent);
    }

    handleKeyDown(event) {
        if (!this.app.selectedObject) return;

        let moved = false;
        const step = event.shiftKey ? 10 : 1;

        switch (event.key) {
            case 'ArrowLeft':
                {
                    const currentX = this.app.getPropertyValue(this.app.selectedObject, 'x');
                    this.app.updateObjectProperty(this.app.selectedObject, 'x', currentX - step);
                    moved = true;
                }
                break;
            case 'ArrowRight':
                {
                    const currentX = this.app.getPropertyValue(this.app.selectedObject, 'x');
                    this.app.updateObjectProperty(this.app.selectedObject, 'x', currentX + step);
                    moved = true;
                }
                break;
            case 'ArrowUp':
                {
                    const currentY = this.app.getPropertyValue(this.app.selectedObject, 'y');
                    this.app.updateObjectProperty(this.app.selectedObject, 'y', currentY - step);
                    moved = true;
                }
                break;
            case 'ArrowDown':
                {
                    const currentY = this.app.getPropertyValue(this.app.selectedObject, 'y');
                    this.app.updateObjectProperty(this.app.selectedObject, 'y', currentY + step);
                    moved = true;
                }
                break;
            case 'Delete':
            case 'Backspace':
                this.deleteSelectedObject();
                break;
        }

        if (moved) {
            event.preventDefault();
            this.render();
            this.app.redraw();
            if (this.app.timeline) {
                this.app.timeline.update();
            }
            if (window.UIManager) {
                window.UIManager.updateRightPanel();
            }
        }
    }

    handleResize() {
        // Debounce resize events
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.setupHighDPICanvas();
            this.render();
        }, 100);
    }

    handleSelectStart(pos, event) {
        const clickedObject = this.getObjectAtPosition(pos);

        if (clickedObject) {
            this.app.setSelectedObject(clickedObject);
            this.dragStartPos = pos;
            this.objectStartPos = { x: clickedObject.x, y: clickedObject.y };
        } else {
            this.app.setSelectedObject(null);
        }
    }

    handleTextPlacement(pos) {
        const text = prompt('Enter text:');
        if (text && text.trim()) {
            const textObject = this.app.createTextObject(text.trim(), pos.x, pos.y);
            this.app.addTextObject(textObject);
            this.app.setSelectedObject(textObject);
            this.render();

            if (window.UIManager) {
                window.UIManager.updateRightPanel();
            }
        }
    }

    handleObjectDrag(pos, event) {
        if (!this.app.selectedObject || !this.dragStartPos) return;

        let deltaX = pos.x - this.dragStartPos.x;
        let deltaY = pos.y - this.dragStartPos.y;

        // Constrain movement to 90° angles when shift key is held
        if (event && event.shiftKey) {
            const angle = Math.atan2(deltaY, deltaX);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            // Snap to nearest 90° angle (0°, 90°, 180°, 270°)
            const snapAngle = Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);

            deltaX = distance * Math.cos(snapAngle);
            deltaY = distance * Math.sin(snapAngle);
        }

        const newX = this.objectStartPos.x + deltaX;
        const newY = this.objectStartPos.y + deltaY;

        // Use updateObjectProperty to ensure keyframes are created
        this.app.updateObjectProperty(this.app.selectedObject, 'x', newX);
        this.app.updateObjectProperty(this.app.selectedObject, 'y', newY);

        this.render();
        this.objectWasModified = true;

        if (window.UIManager) {
            window.UIManager.updateRightPanel();
        }
    }

    handleObjectMove(pos, event) {
        this.handleObjectDrag(pos, event);
    }

    handleObjectRotate(pos) {
        if (!this.app.selectedObject || !this.lastMousePos) return;

        const obj = this.app.selectedObject;
        const centerX = obj.x + (obj.width || 100) / 2;
        const centerY = obj.y + (obj.fontSize || 20) / 2;

        const lastAngle = Math.atan2(this.lastMousePos.y - centerY, this.lastMousePos.x - centerX);
        const currentAngle = Math.atan2(pos.y - centerY, pos.x - centerX);

        const deltaAngle = (currentAngle - lastAngle) * (180 / Math.PI);
        obj.rotation = (obj.rotation || 0) + deltaAngle;

        // Normalize rotation to 0-360 range
        obj.rotation = ((obj.rotation % 360) + 360) % 360;

        this.render();
        this.objectWasModified = true;

        if (window.UIManager) {
            window.UIManager.updateRightPanel();
        }
    }

    handleObjectScale(pos) {
        if (!this.app.selectedObject || !this.dragStartPos) return;

        const obj = this.app.selectedObject;
        const centerX = obj.x + (obj.width || 100) / 2;
        const centerY = obj.y + (obj.fontSize || 20) / 2;

        const startDistance = Math.sqrt(
            Math.pow(this.dragStartPos.x - centerX, 2) +
            Math.pow(this.dragStartPos.y - centerY, 2)
        );

        const currentDistance = Math.sqrt(
            Math.pow(pos.x - centerX, 2) +
            Math.pow(pos.y - centerY, 2)
        );

        if (startDistance > 0) {
            const scaleFactor = currentDistance / startDistance;
            const newFontSize = Math.max(8, Math.min(200, (obj.baseFontSize || obj.fontSize) * scaleFactor));
            obj.fontSize = newFontSize;

            this.render();
            this.objectWasModified = true;

            if (window.UIManager) {
                window.UIManager.updateRightPanel();
            }
        }
    }

    getObjectAtPosition(pos) {
        // Check objects in reverse order (top to bottom)
        for (let i = this.app.textObjects.length - 1; i >= 0; i--) {
            const obj = this.app.textObjects[i];
            if (this.isPositionInObject(pos, obj)) {
                return obj;
            }
        }
        return null;
    }

    isPositionInObject(pos, obj) {
        // Estimate text dimensions for hit testing
        this.context.font = `${obj.fontSize}px "${obj.fontFamily}"`;
        const metrics = this.context.measureText(obj.text);
        const width = metrics.width;
        const height = obj.fontSize;

        return pos.x >= obj.x && pos.x <= obj.x + width &&
            pos.y >= obj.y && pos.y <= obj.y + height;
    }

    updateCursor(pos) {
        const hoveredObject = this.getObjectAtPosition(pos);
        let cursor = 'default';

        if (this.app.currentTool === 'text') {
            cursor = 'text';
        } else if (this.app.currentTool === 'select') {
            cursor = hoveredObject ? 'move' : 'default';
        } else if (this.app.currentTool === 'hand') {
            cursor = 'grab';
        } else if (this.app.currentTool === 'move') {
            cursor = 'move';
        } else if (this.app.currentTool === 'rotate') {
            cursor = 'crosshair';
        } else if (this.app.currentTool === 'scale') {
            cursor = 'nw-resize';
        }

        this.canvas.style.cursor = cursor;
    }

    finalizeSelection() {
        if (this.objectWasModified && this.app.selectedObject) {
            // Store undo state
            this.app.storeUndoState();
        }
    }

    deleteSelectedObject() {
        if (this.app.selectedObject) {
            const index = this.app.textObjects.indexOf(this.app.selectedObject);
            if (index > -1) {
                this.app.textObjects.splice(index, 1);
                this.app.setSelectedObject(null);
                this.render();

                if (window.UIManager) {
                    window.UIManager.updateRightPanel();
                }

                // Update timeline
                if (this.app.timelineManager) {
                    this.app.timelineManager.render();
                }
            }
        }
    }

    render() {
        if (!this.context) return;

        // Clear canvas
        this.context.clearRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);

        // Draw background
        this.drawBackground();

        // Draw grid if enabled
        if (this.app.showGrid) {
            this.drawGrid();
        }

        // Draw all text objects
        this.app.textObjects.forEach(obj => {
            this.drawTextObject(obj);
        });

        // Draw selection indicator
        if (this.app.selectedObject) {
            this.drawSelectionIndicator(this.app.selectedObject);
        }

        // Draw guides if dragging
        if (this.isDragging && this.app.showGuides) {
            this.drawGuides();
        }
    }

    drawBackground() {
        // Fill with background color
        this.context.fillStyle = this.app.canvasBackground;
        this.context.fillRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);

        // Add subtle texture if desired
        if (this.app.canvasBackground !== '#ffffff' && this.app.canvasBackground !== 'white') {
            this.drawBackgroundTexture();
        }
    }

    drawBackgroundTexture() {
        // Create a subtle noise pattern
        const imageData = this.context.createImageData(this.app.canvasWidth, this.app.canvasHeight);
        const data = imageData.data;

        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 10;
            data[i] = data[i + 1] = data[i + 2] = noise;
            data[i + 3] = 5; // Very low opacity
        }

        this.context.putImageData(imageData, 0, 0);
    }

    drawGrid() {
        const gridSize = 20;
        const gridColor = this.app.canvasBackground === '#ffffff' ? '#e0e0e0' : '#404040';

        this.context.strokeStyle = gridColor;
        this.context.lineWidth = 0.5;
        this.context.setLineDash([1, 1]);

        // Vertical lines
        for (let x = 0; x <= this.app.canvasWidth; x += gridSize) {
            this.context.beginPath();
            this.context.moveTo(x, 0);
            this.context.lineTo(x, this.app.canvasHeight);
            this.context.stroke();
        }

        // Horizontal lines
        for (let y = 0; y <= this.app.canvasHeight; y += gridSize) {
            this.context.beginPath();
            this.context.moveTo(0, y);
            this.context.lineTo(this.app.canvasWidth, y);
            this.context.stroke();
        }

        this.context.setLineDash([]);
    }

    drawTextObject(obj) {
        this.context.save();

        // Get properties for current frame
        const props = this.app.getObjectPropertiesAtFrame(obj, this.app.currentFrame);

        console.log('Canvas: Drawing text object with OpenType features:', {
            text: obj.text,
            fontFamily: obj.fontFamily,
            openTypeFeatures: props.openTypeFeatures,
            hasFeatures: props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0
        });

        // Apply rotation if present
        if (props.rotation && props.rotation !== 0) {
            this.context.font = `${props.fontSize}px "${obj.fontFamily}"`;
            const metrics = this.context.measureText(obj.text);
            const centerX = props.x + metrics.width / 2;
            const centerY = props.y + props.fontSize / 2;

            this.context.translate(centerX, centerY);
            this.context.rotate((props.rotation * Math.PI) / 180);
            this.context.translate(-centerX, -centerY);
        }

        // Check if font is available
        const fontAvailable = this.app.fonts.has(obj.fontFamily) && this.app.isFontLoaded(obj.fontFamily);

        if (fontAvailable) {
            // Apply font features (variable axes and OpenType features)
            const hasVariableAxes = props.variableAxes && Object.keys(props.variableAxes).length > 0;
            const hasOpenTypeFeatures = props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0;

            if (hasVariableAxes || hasOpenTypeFeatures) {
                this.applyFontFeaturesToCanvas(obj.fontFamily, props.fontSize, props.variableAxes, props.openTypeFeatures);
            } else {
                this.context.font = `${props.fontSize}px "${obj.fontFamily}"`;
            }
        } else {
            // Use fallback font when the desired font is not available
            this.context.font = `${props.fontSize}px Arial, sans-serif`;
        }

        this.context.fillStyle = props.color;
        this.context.textBaseline = 'top';
        this.context.textAlign = obj.textAlign || 'left';

        // Draw the text
        this.context.fillText(obj.text, props.x, props.y);

        // Clean up canvas styles if font features were applied
        if (this._originalCanvasStyles) {
            const canvas = this.context.canvas;
            canvas.style.fontFamily = this._originalCanvasStyles.fontFamily || '';
            canvas.style.fontVariationSettings = this._originalCanvasStyles.fontVariationSettings || '';
            canvas.style.fontFeatureSettings = this._originalCanvasStyles.fontFeatureSettings || '';
            canvas.style.fontSize = '';
            delete this._originalCanvasStyles;
        }

        this.context.restore();
    }

    // Apply font features (variable axes and OpenType features) to canvas context
    applyFontFeaturesToCanvas(fontFamily, fontSize, variableAxes = {}, openTypeFeatures = {}) {
        try {
            const canvas = this.context.canvas;
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

            console.log('Canvas: Applying font features:', {
                fontVariationSettings,
                fontFeatureSettings
            });

            // Apply font settings to the canvas element temporarily
            canvas.style.fontFamily = `"${fontFamily}"`;
            if (fontVariationSettings) {
                canvas.style.fontVariationSettings = fontVariationSettings;
                console.log(`Canvas: Applied fontVariationSettings: ${fontVariationSettings}`);
            }
            if (fontFeatureSettings) {
                canvas.style.fontFeatureSettings = fontFeatureSettings;
                console.log(`Canvas: Applied fontFeatureSettings: ${fontFeatureSettings}`);
            }
            canvas.style.fontSize = `${fontSize}px`;

            // Apply the font to the context
            this.context.font = `${fontSize}px "${fontFamily}"`;

            // Store original styles for cleanup
            this._originalCanvasStyles = {
                fontFamily: originalFontFamily,
                fontVariationSettings: originalFontVariationSettings,
                fontFeatureSettings: originalFontFeatureSettings
            };

        } catch (error) {
            console.warn('Canvas: Failed to apply font features:', error);
            // Fallback to basic font
            this.context.font = `${fontSize}px "${fontFamily}"`;
        }
    }

    drawSelectionIndicator(obj) {
        const props = this.app.getObjectPropertiesAtFrame(obj, this.app.currentFrame);

        // Get accurate text dimensions with font features applied
        const bounds = this.app.getAccurateTextBounds(obj, this.app.currentFrame);

        // Draw selection rectangle using accurate bounds
        this.context.strokeStyle = '#0078d4';
        this.context.lineWidth = 2;
        this.context.setLineDash([5, 5]);
        this.context.strokeRect(bounds.left, bounds.top,
            bounds.right - bounds.left, bounds.bottom - bounds.top);
        this.context.setLineDash([]);

        // Draw position origin mark
        this.context.strokeStyle = '#ff4444';
        this.context.fillStyle = '#ff4444';
        this.context.lineWidth = 2;

        // Draw crosshair at origin position
        const crossSize = 8;
        this.context.beginPath();
        // Horizontal line
        this.context.moveTo(props.x - crossSize, props.y);
        this.context.lineTo(props.x + crossSize, props.y);
        // Vertical line
        this.context.moveTo(props.x, props.y - crossSize);
        this.context.lineTo(props.x, props.y + crossSize);
        this.context.stroke();

        // Draw small circle at center
        this.context.beginPath();
        this.context.arc(props.x, props.y, 3, 0, 2 * Math.PI);
        this.context.fill();

        // Draw resize handles
        const handleSize = 6;
        const handles = [
            { x: props.x - 5, y: props.y - 5 }, // Top-left
            { x: props.x + width + 5, y: props.y - 5 }, // Top-right
            { x: props.x - 5, y: props.y + height + 5 }, // Bottom-left
            { x: props.x + width + 5, y: props.y + height + 5 }, // Bottom-right
        ];

        this.context.fillStyle = '#0078d4';
        handles.forEach(handle => {
            this.context.fillRect(
                handle.x - handleSize / 2,
                handle.y - handleSize / 2,
                handleSize,
                handleSize
            );
        });
    }

    drawGuides() {
        // Draw alignment guides when dragging objects
        if (!this.app.selectedObject) return;

        const selectedProps = this.app.getObjectPropertiesAtFrame(this.app.selectedObject, this.app.currentFrame);

        this.context.strokeStyle = '#ff6b6b';
        this.context.lineWidth = 1;
        this.context.setLineDash([2, 2]);

        // Check for alignment with other objects
        this.app.textObjects.forEach(obj => {
            if (obj === this.app.selectedObject) return;

            const objProps = this.app.getObjectPropertiesAtFrame(obj, this.app.currentFrame);

            // Vertical alignment
            if (Math.abs(selectedProps.x - objProps.x) < 5) {
                this.context.beginPath();
                this.context.moveTo(objProps.x, 0);
                this.context.lineTo(objProps.x, this.app.canvasHeight);
                this.context.stroke();
            }

            // Horizontal alignment
            if (Math.abs(selectedProps.y - objProps.y) < 5) {
                this.context.beginPath();
                this.context.moveTo(0, objProps.y);
                this.context.lineTo(this.app.canvasWidth, objProps.y);
                this.context.stroke();
            }
        });

        this.context.setLineDash([]);
    }

    // Export current canvas as image
    exportAsImage(format = 'png', quality = 1.0) {
        return this.canvas.toDataURL(`image/${format}`, quality);
    }

    // Set rendering quality
    setRenderingQuality(quality) {
        this.renderingQuality = quality;

        const settings = {
            low: { imageSmoothingEnabled: false },
            medium: { imageSmoothingEnabled: true, imageSmoothingQuality: 'medium' },
            high: { imageSmoothingEnabled: true, imageSmoothingQuality: 'high' }
        };

        const setting = settings[quality] || settings.high;
        Object.assign(this.context, setting);

        this.render();
    }

    // Toggle grid visibility
    toggleGrid() {
        this.app.showGrid = !this.app.showGrid;
        this.render();
    }

    // Toggle guides visibility
    toggleGuides() {
        this.app.showGuides = !this.app.showGuides;
        this.render();
    }

    // Clean up
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }

        // Remove event listeners
        if (this.canvas) {
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
            this.canvas.removeEventListener('touchstart', this.handleTouchStart);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
            this.canvas.removeEventListener('touchend', this.handleTouchEnd);
        }

        document.removeEventListener('keydown', this.handleKeyDown);
    }

    handlePanStart(event) {
        // Store initial scroll position and mouse position for panning
        const canvasContainer = document.getElementById('canvasContainer');
        this.panStartX = event.clientX;
        this.panStartY = event.clientY;
        this.panStartScrollX = canvasContainer.scrollLeft;
        this.panStartScrollY = canvasContainer.scrollTop;

        // Add grabbing cursor
        this.canvas.classList.add('grabbing');

        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
    }

    handlePanDrag(event) {
        if (this.panStartX === undefined || this.panStartY === undefined) return;

        const canvasContainer = document.getElementById('canvasContainer');
        const deltaX = this.panStartX - event.clientX;
        const deltaY = this.panStartY - event.clientY;

        // Update scroll position - this moves the scrollbars
        canvasContainer.scrollLeft = this.panStartScrollX + deltaX;
        canvasContainer.scrollTop = this.panStartScrollY + deltaY;

        // Prevent default to stop any other behavior
        event.preventDefault();
        event.stopPropagation();
    }

    handlePanEnd() {
        // Clean up pan state
        this.panStartX = undefined;
        this.panStartY = undefined;
        this.panStartScrollX = undefined;
        this.panStartScrollY = undefined;

        // Remove grabbing cursor
        this.canvas.classList.remove('grabbing');
    }
}

// Make CanvasManager available globally
window.CanvasManager = CanvasManager;