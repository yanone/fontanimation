// Enhanced Timeline management with better keyframe handling
class TimelineManager {
    constructor(app) {
        this.app = app;
        this.selectedKeyframes = [];
        this.isDraggingCursor = false;
        this.setup();
    }

    setup() {
        this.setupScrollSynchronization();
        this.update();
    }

    setupScrollSynchronization() {
        // Synchronize vertical scrolling between layer names and layer content
        const layerNames = document.getElementById('timelineLayerNames');
        const layerContent = document.getElementById('timelineLayers');

        if (layerNames && layerContent) {
            layerNames.addEventListener('scroll', () => {
                layerContent.scrollTop = layerNames.scrollTop;
            });

            layerContent.addEventListener('scroll', () => {
                layerNames.scrollTop = layerContent.scrollTop;
            });
        }
    }

    // Helper method to calculate timeline width using settings
    calculateTimelineWidth() {
        const minPixelsPerSecond = window.AppSettings?.get('minPixelsPerSecond') || 80;
        const minTimelineWidth = window.AppSettings?.get('minTimelineWidth') || 800;
        return Math.max(minTimelineWidth, this.app.duration * minPixelsPerSecond);
    }

    update() {
        this.updateTimeRuler();
        this.updateLayers();
        this.updateCursor();
    }

    updateTimeRuler() {
        const timeRuler = document.getElementById('timeRuler');
        const totalFrames = this.app.totalFrames;

        // Calculate timeline width using settings
        const timelineWidth = this.calculateTimelineWidth();
        console.log(`Timeline width calculated: ${timelineWidth}px (duration: ${this.app.duration}s, total frames: ${totalFrames})`);

        // Set the timeline content wrapper width to establish scrollable area
        const timelineContent = document.getElementById('timelineContent');
        if (timelineContent) {
            timelineContent.style.width = `${timelineWidth}px`; // Timeline width only, layer headers are in separate column
        }

        // Set the timeline ruler width
        timeRuler.style.width = `${timelineWidth}px`;

        // Set all timeline layer widths to match
        const timelineLayers = document.querySelectorAll('.timeline-layer');
        timelineLayers.forEach(layer => {
            layer.style.width = `${timelineWidth}px`;
        });

        // Clear only the time marks, not the cursor
        const existingMarks = timeRuler.querySelectorAll('.time-mark');
        existingMarks.forEach(mark => mark.remove());

        // Ensure cursor exists
        let timeCursor = document.getElementById('timeCursor');
        if (!timeCursor) {
            timeCursor = document.createElement('div');
            timeCursor.id = 'timeCursor';
            timeRuler.appendChild(timeCursor);

            // Set up cursor dragging
            this.setupCursorDragging(timeCursor);
        }

        // Calculate optimal mark spacing
        const targetMarks = 20;
        const frameStep = Math.max(1, Math.ceil(totalFrames / targetMarks));
        const roundedStep = this.roundToNiceNumber(frameStep);

        // Add frame marks
        for (let i = 0; i <= totalFrames; i += roundedStep) {
            const mark = document.createElement('div');
            mark.className = 'time-mark';
            mark.style.left = `${(i / totalFrames) * timelineWidth}px`;

            const label = document.createElement('div');
            label.className = 'time-label';
            label.textContent = i.toString();

            mark.appendChild(label);
            timeRuler.appendChild(mark);
        }

        // Add minor marks
        for (let i = 0; i <= totalFrames; i += Math.max(1, roundedStep / 5)) {
            if (i % roundedStep !== 0) {
                const mark = document.createElement('div');
                mark.className = 'time-mark';
                mark.style.left = `${(i / totalFrames) * timelineWidth}px`;
                mark.style.height = '50%';
                mark.style.top = '50%';
                mark.style.background = '#505050';
                timeRuler.appendChild(mark);
            }
        }
    }

    roundToNiceNumber(num) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(num)));
        const normalized = num / magnitude;

        let nice;
        if (normalized <= 1) nice = 1;
        else if (normalized <= 2) nice = 2;
        else if (normalized <= 5) nice = 5;
        else nice = 10;

        return nice * magnitude;
    }

    updateLayers() {
        const timelineLayers = document.getElementById('timelineLayers');
        const timelineLayerNames = document.getElementById('timelineLayerNames');
        timelineLayers.innerHTML = '';
        timelineLayerNames.innerHTML = '';

        this.app.textObjects.forEach((textObject, index) => {
            const layerName = this.createLayerName(textObject, index);
            const layerContent = this.createLayerContent(textObject, index);

            timelineLayerNames.appendChild(layerName);
            timelineLayers.appendChild(layerContent);
        });

        // Update cursor extensions for new layers
        this.updateCursorExtensions((this.app.currentFrame / this.app.totalFrames) * this.calculateTimelineWidth() - 1);
    }

    createLayerName(textObject, index) {
        const layerGroup = document.createElement('div');
        layerGroup.className = 'timeline-layer-group';
        layerGroup.dataset.objectId = textObject.id;

        // Main text object header
        const mainHeader = document.createElement('div');
        mainHeader.className = 'timeline-layer-name main-layer';
        mainHeader.textContent = textObject.text.length > 15
            ? textObject.text.substring(0, 15) + '...'
            : textObject.text || `Layer ${index + 1}`;
        mainHeader.title = textObject.text;
        layerGroup.appendChild(mainHeader);

        // Only show property sub-layers that have keyframes
        Object.keys(textObject.keyframes).forEach(property => {
            const keyframes = textObject.keyframes[property];
            if (keyframes && keyframes.length > 0) {
                const subLayer = document.createElement('div');
                subLayer.className = 'timeline-layer-name sub-layer';
                subLayer.dataset.property = property;
                subLayer.textContent = this.getPropertyDisplayName(property);
                layerGroup.appendChild(subLayer);
            }
        });

        return layerGroup;
    }

    createLayerContent(textObject, index) {
        const layerGroup = document.createElement('div');
        layerGroup.className = 'timeline-layer-group';
        layerGroup.dataset.objectId = textObject.id;

        // Main layer (empty spacer)
        const mainLayer = document.createElement('div');
        mainLayer.className = 'timeline-layer main-layer';
        layerGroup.appendChild(mainLayer);

        // Only show property sub-layers that have keyframes
        Object.keys(textObject.keyframes).forEach(property => {
            const keyframes = textObject.keyframes[property];
            if (keyframes && keyframes.length > 0) {
                const subLayer = this.createPropertyLayer(textObject, property);
                layerGroup.appendChild(subLayer);
            }
        });

        return layerGroup;
    }

    createPropertyLayer(textObject, property) {
        const layer = document.createElement('div');
        layer.className = 'timeline-layer sub-layer';
        layer.dataset.objectId = textObject.id;
        layer.dataset.property = property;

        // Add existing keyframes for this property
        const keyframes = textObject.keyframes[property] || [];
        keyframes.forEach(keyframe => {
            const keyframeElement = this.createPropertyKeyframe(keyframe, textObject, property);
            layer.appendChild(keyframeElement);
        });

        // Add keyframe spans between keyframes
        this.addPropertyKeyframeSpans(layer, textObject, property);

        // Add event listeners
        this.setupPropertyLayerEventListeners(layer, textObject, property);

        return layer;
    }

    getPropertyDisplayName(property) {
        const displayNames = {
            x: 'X Position',
            y: 'Y Position',
            fontSize: 'Font Size',
            color: 'Color'
        };
        return displayNames[property] || property;
    }

    createPropertyKeyframe(keyframe, textObject, property) {
        const keyframeElement = document.createElement('div');
        keyframeElement.className = 'keyframe';
        keyframeElement.dataset.frame = keyframe.frame;
        keyframeElement.dataset.property = property;
        keyframeElement.dataset.objectId = textObject.id;

        const timelineWidth = this.calculateTimelineWidth();
        const position = (keyframe.frame / this.app.totalFrames) * timelineWidth;
        // Center the keyframe dot by subtracting half its width (7px)
        keyframeElement.style.left = `${position - 7}px`;

        return keyframeElement;
    }

    addPropertyKeyframeSpans(content, textObject, property) {
        const keyframes = textObject.keyframes[property] || [];
        if (keyframes.length < 2) return;

        const timelineWidth = this.calculateTimelineWidth();

        for (let i = 0; i < keyframes.length - 1; i++) {
            const startFrame = keyframes[i].frame;
            const endFrame = keyframes[i + 1].frame;

            const span = document.createElement('div');
            span.className = 'keyframe-span';

            const startPosition = (startFrame / this.app.totalFrames) * timelineWidth;
            const endPosition = (endFrame / this.app.totalFrames) * timelineWidth;

            span.style.left = `${startPosition}px`;
            span.style.width = `${Math.max(2, endPosition - startPosition)}px`;

            content.appendChild(span);
        }
    }

    setupPropertyLayerEventListeners(layer, textObject, property) {
        // Keyframe selection and dragging
        layer.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('keyframe')) {
                this.handlePropertyKeyframeMouseDown(e, textObject, property);
            }
        });
    }

    addPropertyKeyframe(textObject, property, frame) {
        // Get current value at this frame or use a default
        const currentValue = this.app.getPropertyValue(textObject, property, frame);
        this.app.setKeyframe(textObject, property, frame, currentValue);

        this.updateLayers();
        this.app.redraw();
        this.app.saveState();
    }

    handlePropertyKeyframeMouseDown(e, textObject, property) {
        const keyframe = e.target;
        const frame = parseInt(keyframe.dataset.frame);

        // Select keyframe
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.clearKeyframeSelection();
        }
        this.selectPropertyKeyframe(textObject.id, property, frame);

        // Start dragging
        let isDragging = false;
        const startX = e.clientX;
        const startFrame = frame;

        const onMouseMove = (e) => {
            if (!isDragging && Math.abs(e.clientX - startX) > 5) {
                isDragging = true;
            }

            if (isDragging) {
                const rect = keyframe.parentElement.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const timelineWidth = this.calculateTimelineWidth();
                const newFrame = Math.max(0, Math.min(this.app.totalFrames - 1,
                    Math.round((x / timelineWidth) * this.app.totalFrames)));

                this.movePropertyKeyframe(textObject, property, startFrame, newFrame);
            }
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (isDragging) {
                this.app.saveState();
            }
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    movePropertyKeyframe(textObject, property, oldFrame, newFrame) {
        const keyframes = textObject.keyframes[property];
        if (!keyframes) return;

        const keyframeIndex = keyframes.findIndex(kf => kf.frame === oldFrame);
        if (keyframeIndex >= 0) {
            keyframes[keyframeIndex].frame = newFrame;
            keyframes.sort((a, b) => a.frame - b.frame);
            this.updateLayers();
            this.app.redraw();
        }
    }

    selectPropertyKeyframe(objectId, property, frame) {
        // Implementation for keyframe selection
        // This will be used for visual feedback and deletion
    }

    clearKeyframeSelection() {
        // Clear all selected keyframes
        document.querySelectorAll('.keyframe.selected').forEach(kf => {
            kf.classList.remove('selected');
        });
    }





    setupLayerEventListeners(layer, textObject) {
        // In the new structure, the layer element itself is the content area
        const content = layer;

        // Keyframe selection and dragging
        content.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('keyframe')) {
                this.handleKeyframeMouseDown(e, textObject);
            }
        });

        // Context menu for keyframe deletion
        content.addEventListener('contextmenu', (e) => {
            if (e.target.classList.contains('keyframe')) {
                e.preventDefault();
                this.showKeyframeContextMenu(e, textObject);
            }
        });
    }

    handleKeyframeMouseDown(e, textObject) {
        const keyframe = e.target;
        const frame = parseInt(keyframe.dataset.frame);

        // Select keyframe
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
            this.clearKeyframeSelection();
        }
        this.selectKeyframe(textObject.id, frame);

        // Start dragging
        let isDragging = false;
        const startX = e.clientX;
        const startFrame = frame;

        const handleMouseMove = (e) => {
            if (!isDragging && Math.abs(e.clientX - startX) > 5) {
                isDragging = true;
                keyframe.style.cursor = 'grabbing';
            }

            if (isDragging) {
                const content = keyframe.parentElement;
                const rect = content.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const newFrame = Math.max(0, Math.min(this.app.totalFrames - 1,
                    Math.round((x / rect.width) * this.app.totalFrames)));

                // Check if frame is available
                const existingKeyframe = textObject.keyframes.find(kf => kf.frame === newFrame && kf.frame !== startFrame);
                if (!existingKeyframe) {
                    this.moveKeyframe(textObject, startFrame, newFrame);
                }
            }
        };

        const handleMouseUp = () => {
            if (isDragging) {
                this.app.saveState();
                keyframe.style.cursor = '';
            }
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }

    showKeyframeContextMenu(e, textObject) {
        const frame = parseInt(e.target.dataset.frame);

        // Create a simple context menu
        const menu = document.createElement('div');
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: #2b2b2b;
            border: 1px solid #404040;
            border-radius: 4px;
            padding: 8px 0;
            z-index: 1000;
            min-width: 120px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        const deleteOption = document.createElement('div');
        deleteOption.style.cssText = `
            padding: 8px 16px;
            cursor: pointer;
            color: #ffffff;
            font-size: 12px;
        `;
        deleteOption.textContent = 'Delete Keyframe';
        deleteOption.addEventListener('mouseenter', () => {
            deleteOption.style.background = '#d32f2f';
        });
        deleteOption.addEventListener('mouseleave', () => {
            deleteOption.style.background = 'transparent';
        });
        deleteOption.addEventListener('click', () => {
            this.deleteKeyframe(textObject, frame);
            document.body.removeChild(menu);
        });

        menu.appendChild(deleteOption);
        document.body.appendChild(menu);

        // Remove menu on click outside
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                document.body.removeChild(menu);
                document.removeEventListener('click', removeMenu);
            }
        };
        setTimeout(() => document.addEventListener('click', removeMenu), 100);
    }

    addKeyframe(textObject, frame) {
        // Check if keyframe already exists at this frame
        const existingKeyframe = textObject.keyframes.find(kf => kf.frame === frame);
        if (existingKeyframe) {
            if (window.UIManager) {
                window.UIManager.createNotification('Keyframe already exists at this frame', 'warning');
            }
            return;
        }

        // Get current properties for the new keyframe
        const currentProps = this.app.getObjectPropertiesAtFrame(textObject, frame);

        const newKeyframe = {
            frame: frame,
            properties: { ...currentProps },
            curve: {
                cp1x: 33.33, cp1y: 0,
                cp2x: 66.67, cp2y: 100
            }
        };

        textObject.keyframes.push(newKeyframe);
        textObject.keyframes.sort((a, b) => a.frame - b.frame);

        this.update();
        this.app.saveState();

        if (window.UIManager) {
            window.UIManager.createNotification(`Added keyframe at frame ${frame}`, 'success');
        }
    }

    deleteKeyframe(textObject, frame) {
        const keyframeIndex = textObject.keyframes.findIndex(kf => kf.frame === frame);
        if (keyframeIndex > -1 && textObject.keyframes.length > 1) {
            textObject.keyframes.splice(keyframeIndex, 1);
            this.clearKeyframeSelection();
            this.update();
            this.app.redraw();
            this.app.saveState();

            if (window.UIManager) {
                window.UIManager.createNotification(`Deleted keyframe at frame ${frame}`, 'info');
            }
        } else if (textObject.keyframes.length === 1) {
            if (window.UIManager) {
                window.UIManager.createNotification('Cannot delete the last keyframe', 'warning');
            }
        }
    }

    moveKeyframe(textObject, oldFrame, newFrame) {
        const keyframe = textObject.keyframes.find(kf => kf.frame === oldFrame);
        if (keyframe) {
            keyframe.frame = newFrame;
            textObject.keyframes.sort((a, b) => a.frame - b.frame);
            this.update();
            this.app.redraw();
        }
    }

    selectKeyframe(objectId, frame) {
        const key = `${objectId}-${frame}`;
        if (!this.selectedKeyframes.includes(key)) {
            this.selectedKeyframes.push(key);
        }
        this.updateKeyframeSelection();
        this.updateInterpolationPanel();
    }

    clearKeyframeSelection() {
        this.selectedKeyframes = [];
        this.updateKeyframeSelection();
        this.updateInterpolationPanel();
    }

    isKeyframeSelected(objectId, frame) {
        return this.selectedKeyframes.includes(`${objectId}-${frame}`);
    }

    updateKeyframeSelection() {
        // Update visual selection in timeline
        document.querySelectorAll('.keyframe').forEach(keyframe => {
            const objectId = keyframe.dataset.objectId;
            const frame = keyframe.dataset.frame;

            if (this.isKeyframeSelected(objectId, parseInt(frame))) {
                keyframe.classList.add('selected');
            } else {
                keyframe.classList.remove('selected');
            }
        });
    }

    updateInterpolationPanel() {
        const interpolationPanel = document.getElementById('interpolationPanel');

        if (this.selectedKeyframes.length >= 2) {
            const validPairs = this.getConsecutiveKeyframePairs();

            if (validPairs.length > 0) {
                interpolationPanel.style.display = 'block';
                this.setupCurveEditor(validPairs[0]);
            } else {
                interpolationPanel.style.display = 'none';
            }
        } else {
            interpolationPanel.style.display = 'none';
        }
    }

    getConsecutiveKeyframePairs() {
        const keyframesByObject = {};

        this.selectedKeyframes.forEach(key => {
            const [objectId, frame] = key.split('-');
            if (!keyframesByObject[objectId]) {
                keyframesByObject[objectId] = [];
            }
            keyframesByObject[objectId].push(parseInt(frame));
        });

        const pairs = [];
        Object.entries(keyframesByObject).forEach(([objectId, frames]) => {
            frames.sort((a, b) => a - b);
            for (let i = 0; i < frames.length - 1; i++) {
                const textObject = this.app.textObjects.find(obj => obj.id.toString() === objectId);
                if (textObject) {
                    const keyframes = textObject.keyframes.sort((a, b) => a.frame - b.frame);
                    const currentIndex = keyframes.findIndex(kf => kf.frame === frames[i]);
                    const nextIndex = keyframes.findIndex(kf => kf.frame === frames[i + 1]);

                    if (nextIndex === currentIndex + 1) {
                        pairs.push({
                            objectId: objectId,
                            startFrame: frames[i],
                            endFrame: frames[i + 1],
                            startKeyframe: keyframes[currentIndex],
                            endKeyframe: keyframes[nextIndex]
                        });
                    }
                }
            }
        });

        return pairs;
    }

    setupCurveEditor(pair) {
        const canvas = document.getElementById('curveEditor');
        const ctx = canvas.getContext('2d');

        // Ensure curve exists
        if (!pair.startKeyframe.curve) {
            pair.startKeyframe.curve = {
                cp1x: 33.33, cp1y: 0,
                cp2x: 66.67, cp2y: 100
            };
        }

        this.drawCurve(ctx, pair.startKeyframe.curve);
        this.setupCurveInteraction(canvas, pair);
    }

    drawCurve(ctx, curve) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 4; i++) {
            const x = (i / 4) * width;
            const y = (i / 4) * height;

            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw curve
        ctx.strokeStyle = '#0078d4';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.bezierCurveTo(
            (curve.cp1x / 100) * width, height - (curve.cp1y / 100) * height,
            (curve.cp2x / 100) * width, height - (curve.cp2y / 100) * height,
            width, 0
        );
        ctx.stroke();

        // Draw control points
        this.drawControlPoint(ctx, (curve.cp1x / 100) * width, height - (curve.cp1y / 100) * height);
        this.drawControlPoint(ctx, (curve.cp2x / 100) * width, height - (curve.cp2y / 100) * height);

        // Draw control lines
        ctx.strokeStyle = '#ff6b00';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        ctx.beginPath();
        ctx.moveTo(0, height);
        ctx.lineTo((curve.cp1x / 100) * width, height - (curve.cp1y / 100) * height);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(width, 0);
        ctx.lineTo((curve.cp2x / 100) * width, height - (curve.cp2y / 100) * height);
        ctx.stroke();

        ctx.setLineDash([]);
    }

    drawControlPoint(ctx, x, y) {
        ctx.fillStyle = '#ff6b00';
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    setupCurveInteraction(canvas, pair) {
        let isDragging = false;
        let dragPoint = null;

        const getCurvePoint = (e, curve) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const cp1x = (curve.cp1x / 100) * canvas.width;
            const cp1y = canvas.height - (curve.cp1y / 100) * canvas.height;
            const cp2x = (curve.cp2x / 100) * canvas.width;
            const cp2y = canvas.height - (curve.cp2y / 100) * canvas.height;

            const dist1 = Math.sqrt((x - cp1x) ** 2 + (y - cp1y) ** 2);
            const dist2 = Math.sqrt((x - cp2x) ** 2 + (y - cp2y) ** 2);

            if (dist1 < 12) return 'cp1';
            if (dist2 < 12) return 'cp2';
            return null;
        };

        canvas.addEventListener('mousedown', (e) => {
            dragPoint = getCurvePoint(e, pair.startKeyframe.curve);
            if (dragPoint) {
                isDragging = true;
                canvas.style.cursor = 'grabbing';
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging) {
                const point = getCurvePoint(e, pair.startKeyframe.curve);
                canvas.style.cursor = point ? 'grab' : 'crosshair';
                return;
            }

            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(canvas.width, e.clientX - rect.left));
            const y = Math.max(0, Math.min(canvas.height, e.clientY - rect.top));

            const percentX = (x / canvas.width) * 100;
            const percentY = ((canvas.height - y) / canvas.height) * 100;

            if (dragPoint === 'cp1') {
                pair.startKeyframe.curve.cp1x = percentX;
                pair.startKeyframe.curve.cp1y = percentY;
            } else if (dragPoint === 'cp2') {
                pair.startKeyframe.curve.cp2x = percentX;
                pair.startKeyframe.curve.cp2y = percentY;
            }

            this.drawCurve(canvas.getContext('2d'), pair.startKeyframe.curve);
            this.app.redraw();
        });

        canvas.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                dragPoint = null;
                canvas.style.cursor = 'crosshair';
                this.app.saveState();
            }
        });

        canvas.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                dragPoint = null;
                canvas.style.cursor = 'crosshair';
            }
        });

        // Reset curve button
        document.getElementById('resetCurve').onclick = () => {
            pair.startKeyframe.curve = {
                cp1x: 33.33, cp1y: 0,
                cp2x: 66.67, cp2y: 100
            };
            this.drawCurve(canvas.getContext('2d'), pair.startKeyframe.curve);
            this.app.redraw();
            this.app.saveState();
        };
    }

    updateCursor() {
        console.log('Updating cursor position');
        const timeCursor = document.getElementById('timeCursor');
        const timelineHeader = document.getElementById('timelineHeader');
        const timeRuler = document.getElementById('timeRuler');

        if (!timeCursor || !timeRuler || !timelineHeader) {
            return;
        }

        // Calculate cursor position based on timeline width, not percentage
        const timelineWidth = this.calculateTimelineWidth();
        const cursorPosition = (this.app.currentFrame / this.app.totalFrames) * timelineWidth;

        // Offset by half the cursor width (1px) to center align with keyframes
        // Cursor is 2px wide, so we subtract 1px to center it
        const adjustedPosition = cursorPosition - 1;
        timeCursor.style.left = `${adjustedPosition}px`;

        // Update cursor extensions in all layers
        this.updateCursorExtensions(adjustedPosition);

        // Update keyframe highlighting based on current frame
        this.updateCurrentKeyframeHighlight();

        // Auto-scroll to keep cursor visible during playback or navigation
        // Skip auto-scroll if user is currently dragging the cursor
        if (!this.isDraggingCursor) {
            // No offset needed since layer names are now in a separate fixed column
            this.autoScroll(cursorPosition, timelineWidth);
        }
    }

    updateCurrentKeyframeHighlight() {
        const timelineLayers = document.getElementById('timelineLayers');
        if (!timelineLayers) return;

        console.log(`Highlighting keyframes for frame ${this.app.currentFrame}`);

        // Remove all current class from keyframes
        const allKeyframes = timelineLayers.querySelectorAll('.keyframe');
        allKeyframes.forEach(keyframe => {
            keyframe.classList.remove('current');
        });

        // Add current class to keyframes that match the current frame
        const currentKeyframes = timelineLayers.querySelectorAll(`.keyframe[data-frame="${this.app.currentFrame}"]`);
        currentKeyframes.forEach(keyframe => {
            keyframe.classList.add('current');
            console.log(`Applied 'current' class to keyframe at frame ${keyframe.dataset.frame}`);
        });

        // Force a repaint to ensure the enhanced visual effects are applied
        if (currentKeyframes.length > 0) {
            currentKeyframes.forEach(keyframe => {
                keyframe.style.transform = keyframe.style.transform; // Trigger reflow
            });
        }
    }

    updateCursorExtensions(cursorPosition) {
        const timelineLayers = document.getElementById('timelineLayers');
        if (!timelineLayers) return;

        const layers = timelineLayers.querySelectorAll('.timeline-layer');
        layers.forEach(layer => {
            // In the new structure, the layer itself is the content area
            const content = layer;

            // Find or create cursor extension element
            let cursorExtension = content.querySelector('.cursor-extension');
            if (!cursorExtension) {
                cursorExtension = document.createElement('div');
                cursorExtension.className = 'cursor-extension';
                content.appendChild(cursorExtension);
            }

            // Position the cursor extension to match the main cursor
            cursorExtension.style.left = `${cursorPosition}px`;
        });
    }

    autoScroll(cursorPosition, timelineWidth) {
        const timelineContainer = document.getElementById('timelineContainer');

        if (!timelineContainer) return;

        const containerWidth = timelineContainer.clientWidth;
        const currentScrollLeft = timelineContainer.scrollLeft;
        const margin = Math.min(100, containerWidth * 0.1); // Adaptive margin, max 100px

        // Only auto-scroll if cursor is completely outside visible area
        let newScrollLeft = currentScrollLeft;

        if (cursorPosition < currentScrollLeft) {
            // Cursor is completely off-screen to the left
            newScrollLeft = Math.max(0, cursorPosition - margin);
        } else if (cursorPosition > currentScrollLeft + containerWidth) {
            // Cursor is completely off-screen to the right
            newScrollLeft = Math.min(timelineWidth - containerWidth, cursorPosition - containerWidth + margin);
        }

        // Only scroll if there's a significant change (reduces jitter)
        if (Math.abs(newScrollLeft - currentScrollLeft) > 5) {
            this.smoothScrollTo(newScrollLeft);
        }
    }

    smoothScrollTo(targetScrollLeft) {
        const timelineContainer = document.getElementById('timelineContainer');

        if (!timelineContainer) return;

        // Scroll the unified timeline container
        timelineContainer.scrollLeft = targetScrollLeft;
    }

    setupCursorDragging(timeCursor) {
        timeCursor.addEventListener('mousedown', (e) => {
            e.preventDefault();
            this.isDraggingCursor = true;

            const timeRuler = document.getElementById('timeRuler');
            const timelineContainer = document.getElementById('timelineContainer');

            const handleMouseMove = (e) => {
                const rect = timeRuler.getBoundingClientRect();
                const containerScrollLeft = timelineContainer.scrollLeft;
                const x = e.clientX - rect.left + containerScrollLeft;

                // Convert pixel position to frame
                const pixelsPerFrame = this.calculateTimelineWidth() / this.app.totalFrames;
                const frame = Math.round(x / pixelsPerFrame);
                const clampedFrame = Math.max(0, Math.min(frame, this.app.totalFrames - 1));

                this.app.setCurrentFrame(clampedFrame);
            };

            const handleMouseUp = () => {
                this.isDraggingCursor = false;
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };

            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        });
    }
}

// Expose TimelineManager to window object
window.TimelineManager = TimelineManager;