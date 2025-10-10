// Enhanced Timeline management with better keyframe handling
class TimelineManager {
    constructor(app) {
        this.app = app;
        this.selectedKeyframes = [];
        this.setup();
    }

    setup() {
        this.update();
    }

    update() {
        this.updateTimeRuler();
        this.updateLayers();
        this.updateCursor();
    }

    updateTimeRuler() {
        const timeRuler = document.getElementById('timeRuler');
        const totalFrames = this.app.totalFrames;

        // Calculate timeline width - minimum 20px per second, more for longer durations
        const minPixelsPerSecond = 80;
        const timelineWidth = Math.max(800, this.app.duration * minPixelsPerSecond);

        // Set the timeline ruler width
        timeRuler.style.width = `${timelineWidth}px`;

        // Clear only the time marks, not the cursor
        const existingMarks = timeRuler.querySelectorAll('.time-mark');
        existingMarks.forEach(mark => mark.remove());

        // Ensure cursor exists
        let timeCursor = document.getElementById('timeCursor');
        if (!timeCursor) {
            timeCursor = document.createElement('div');
            timeCursor.id = 'timeCursor';
            timeRuler.appendChild(timeCursor);
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
        timelineLayers.innerHTML = '';

        this.app.textObjects.forEach((textObject, index) => {
            const layer = this.createLayer(textObject, index);
            timelineLayers.appendChild(layer);
        });
    }

    createLayer(textObject, index) {
        const layer = document.createElement('div');
        layer.className = 'timeline-layer';
        layer.dataset.objectId = textObject.id;

        // Layer header
        const header = document.createElement('div');
        header.className = 'layer-header';
        header.textContent = textObject.text.length > 15
            ? textObject.text.substring(0, 15) + '...'
            : textObject.text || `Layer ${index + 1}`;
        header.title = textObject.text;
        layer.appendChild(header);

        // Layer content
        const content = document.createElement('div');
        content.className = 'layer-content';

        // Add keyframes
        textObject.keyframes.forEach(keyframe => {
            const keyframeElement = this.createKeyframe(keyframe, textObject);
            content.appendChild(keyframeElement);
        });

        // Add keyframe spans between keyframes
        this.addKeyframeSpans(content, textObject);

        layer.appendChild(content);

        // Add event listeners
        this.setupLayerEventListeners(layer, textObject);

        return layer;
    }

    createKeyframe(keyframe, textObject) {
        const keyframeElement = document.createElement('div');
        keyframeElement.className = 'keyframe';
        keyframeElement.dataset.frame = keyframe.frame;
        keyframeElement.dataset.objectId = textObject.id;
        keyframeElement.title = `Frame ${keyframe.frame}`;

        // Position based on frame
        const percentage = (keyframe.frame / this.app.totalFrames) * 100;
        keyframeElement.style.left = `${percentage}%`;

        // Check if selected
        if (this.isKeyframeSelected(textObject.id, keyframe.frame)) {
            keyframeElement.classList.add('selected');
        }

        return keyframeElement;
    }

    addKeyframeSpans(content, textObject) {
        const keyframes = textObject.keyframes.sort((a, b) => a.frame - b.frame);

        for (let i = 0; i < keyframes.length - 1; i++) {
            const startFrame = keyframes[i].frame;
            const endFrame = keyframes[i + 1].frame;

            const span = document.createElement('div');
            span.className = 'keyframe-span';
            span.dataset.startFrame = startFrame;
            span.dataset.endFrame = endFrame;
            span.dataset.objectId = textObject.id;

            const startPercentage = (startFrame / this.app.totalFrames) * 100;
            const endPercentage = (endFrame / this.app.totalFrames) * 100;

            span.style.left = `${startPercentage}%`;
            span.style.width = `${Math.max(1, endPercentage - startPercentage)}%`;

            content.appendChild(span);
        }
    }

    setupLayerEventListeners(layer, textObject) {
        const content = layer.querySelector('.layer-content');

        // Double-click to add keyframe
        content.addEventListener('dblclick', (e) => {
            const rect = content.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const frame = Math.round((x / rect.width) * this.app.totalFrames);
            this.addKeyframe(textObject, frame);
        });

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
        const minPixelsPerSecond = 80;
        const timelineWidth = Math.max(800, this.app.duration * minPixelsPerSecond);
        const cursorPosition = (this.app.currentFrame / this.app.totalFrames) * timelineWidth;

        // Position the cursor within the timeRuler
        timeCursor.style.left = `${cursorPosition}px`;

        // Auto-scroll during playback to keep cursor visible
        if (this.app.isPlaying) {
            this.autoScroll(cursorPosition, timelineWidth);
        }
    }

    autoScroll(cursorPosition, timelineWidth) {
        const timelineHeader = document.getElementById('timelineHeader');
        const timelineLayers = document.getElementById('timelineLayers');

        if (!timelineHeader || !timelineLayers) return;

        const headerWidth = timelineHeader.clientWidth;
        const currentScrollLeft = timelineHeader.scrollLeft;
        const margin = Math.min(100, headerWidth * 0.1); // Adaptive margin, max 100px

        // Only auto-scroll if cursor is completely outside visible area
        let newScrollLeft = currentScrollLeft;

        if (cursorPosition < currentScrollLeft) {
            // Cursor is completely off-screen to the left
            newScrollLeft = Math.max(0, cursorPosition - margin);
        } else if (cursorPosition > currentScrollLeft + headerWidth) {
            // Cursor is completely off-screen to the right
            newScrollLeft = Math.min(timelineWidth - headerWidth, cursorPosition - headerWidth + margin);
        }

        // Only scroll if there's a significant change (reduces jitter)
        if (Math.abs(newScrollLeft - currentScrollLeft) > 5) {
            this.smoothScrollTo(newScrollLeft);
        }
    }

    smoothScrollTo(targetScrollLeft) {
        const timelineHeader = document.getElementById('timelineHeader');
        const timelineLayers = document.getElementById('timelineLayers');

        if (!timelineHeader || !timelineLayers) return;

        // Synchronize both header and layers scrolling
        timelineHeader.scrollLeft = targetScrollLeft;
        timelineLayers.scrollLeft = targetScrollLeft;
    }
}

// Expose TimelineManager to window object
window.TimelineManager = TimelineManager;