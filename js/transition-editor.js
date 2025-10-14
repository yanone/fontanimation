// Transition Editor for Bezier curve keyframe interpolation
class TransitionEditor {
    constructor() {
        this.modal = document.getElementById('transitionModal');
        this.canvas = document.getElementById('transitionCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.currentObject = null;
        this.currentProperty = null;
        this.currentApp = null;
        this.currentKeyframe = null;

        // Bezier curve control points (normalized 0-1)
        this.controlPoints = {
            cp1: { x: 0.25, y: 0.25 },
            cp2: { x: 0.75, y: 0.75 }
        };

        this.isDragging = false;
        this.dragPoint = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Modal close handlers
        const closeBtn = this.modal.querySelector('.close');
        closeBtn.addEventListener('click', () => this.closeModal());

        // Click outside modal to close
        this.modal.addEventListener('click', (e) => {
            if (e.target === this.modal) {
                this.closeModal();
            }
        });

        // Escape key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'block') {
                this.closeModal();
            }
        });

        // Canvas interaction
        this.canvas.addEventListener('mousedown', (e) => this.handleCanvasMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleCanvasMouseMove(e));
        this.canvas.addEventListener('mouseup', () => this.handleCanvasMouseUp());
        this.canvas.addEventListener('mouseleave', () => this.handleCanvasMouseUp());

        // Control inputs
        document.getElementById('x1').addEventListener('input', (e) => {
            this.controlPoints.cp1.x = parseFloat(e.target.value);
            this.updateCanvas();
        });

        document.getElementById('y1').addEventListener('input', (e) => {
            this.controlPoints.cp1.y = parseFloat(e.target.value);
            this.updateCanvas();
        });

        document.getElementById('x2').addEventListener('input', (e) => {
            this.controlPoints.cp2.x = parseFloat(e.target.value);
            this.updateCanvas();
        });

        document.getElementById('y2').addEventListener('input', (e) => {
            this.controlPoints.cp2.y = parseFloat(e.target.value);
            this.updateCanvas();
        });

        // Preset buttons
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const curve = btn.dataset.curve.split(',').map(parseFloat);
                this.setControlPoints(curve[0], curve[1], curve[2], curve[3]);
            });
        });

        // Action buttons
        document.getElementById('applyTransition').addEventListener('click', () => this.applyTransition());
        document.getElementById('resetTransition').addEventListener('click', () => this.resetTransition());
        document.getElementById('cancelTransition').addEventListener('click', () => this.closeModal());
    }

    openModal(textObject, property, app) {
        this.currentObject = textObject;
        this.currentProperty = property;
        this.currentApp = app;

        // Find the keyframe at current frame
        this.currentKeyframe = this.findKeyframeAtFrame(textObject, property, app.currentFrame);

        if (this.currentKeyframe) {
            // Load existing curve if available
            if (this.currentKeyframe.curve) {
                const curve = this.currentKeyframe.curve;
                this.setControlPoints(curve.x1, curve.y1, curve.x2, curve.y2);
            } else {
                // Default linear curve
                this.setControlPoints(0, 0, 1, 1);
            }
        } else {
            // No keyframe at current frame, use default
            this.setControlPoints(0.25, 0.25, 0.75, 0.75);
        }

        this.modal.style.display = 'block';
        this.updateCanvas();
    }

    closeModal() {
        this.modal.style.display = 'none';
        this.currentObject = null;
        this.currentProperty = null;
        this.currentApp = null;
        this.currentKeyframe = null;
    }

    findKeyframeAtFrame(textObject, property, frame) {
        if (!textObject.keyframes[property]) return null;
        return textObject.keyframes[property].find(kf => kf.frame === frame);
    }

    setControlPoints(x1, y1, x2, y2) {
        this.controlPoints.cp1.x = x1;
        this.controlPoints.cp1.y = y1;
        this.controlPoints.cp2.x = x2;
        this.controlPoints.cp2.y = y2;

        // Update input fields
        document.getElementById('x1').value = x1;
        document.getElementById('y1').value = y1;
        document.getElementById('x2').value = x2;
        document.getElementById('y2').value = y2;

        this.updateCanvas();
    }

    updateCanvas() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 20;

        // Clear canvas
        this.ctx.clearRect(0, 0, width, height);

        // Draw grid
        this.drawGrid(width, height, padding);

        // Draw bezier curve
        this.drawBezierCurve(width, height, padding);

        // Draw control points
        this.drawControlPoints(width, height, padding);
    }

    drawGrid(width, height, padding) {
        const gridWidth = width - 2 * padding;
        const gridHeight = height - 2 * padding;

        this.ctx.strokeStyle = '#404040';
        this.ctx.lineWidth = 1;

        // Grid lines
        for (let i = 0; i <= 4; i++) {
            const x = padding + (i * gridWidth / 4);
            const y = padding + (i * gridHeight / 4);

            // Vertical lines
            this.ctx.beginPath();
            this.ctx.moveTo(x, padding);
            this.ctx.lineTo(x, height - padding);
            this.ctx.stroke();

            // Horizontal lines
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
        }

        // Border
        this.ctx.strokeStyle = '#606060';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(padding, padding, gridWidth, gridHeight);
    }

    drawBezierCurve(width, height, padding) {
        const gridWidth = width - 2 * padding;
        const gridHeight = height - 2 * padding;

        this.ctx.strokeStyle = '#0078d4';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();

        // Convert normalized coordinates to canvas coordinates
        const startX = padding;
        const startY = height - padding;
        const endX = width - padding;
        const endY = padding;

        const cp1X = padding + this.controlPoints.cp1.x * gridWidth;
        const cp1Y = height - padding - this.controlPoints.cp1.y * gridHeight;
        const cp2X = padding + this.controlPoints.cp2.x * gridWidth;
        const cp2Y = height - padding - this.controlPoints.cp2.y * gridHeight;

        this.ctx.moveTo(startX, startY);
        this.ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, endX, endY);
        this.ctx.stroke();

        // Draw control lines
        this.ctx.strokeStyle = '#888888';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(cp1X, cp1Y);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(cp2X, cp2Y);
        this.ctx.stroke();

        this.ctx.setLineDash([]);
    }

    drawControlPoints(width, height, padding) {
        const gridWidth = width - 2 * padding;
        const gridHeight = height - 2 * padding;

        const cp1X = padding + this.controlPoints.cp1.x * gridWidth;
        const cp1Y = height - padding - this.controlPoints.cp1.y * gridHeight;
        const cp2X = padding + this.controlPoints.cp2.x * gridWidth;
        const cp2Y = height - padding - this.controlPoints.cp2.y * gridHeight;

        // Control point 1
        this.ctx.fillStyle = '#ff4444';
        this.ctx.beginPath();
        this.ctx.arc(cp1X, cp1Y, 6, 0, 2 * Math.PI);
        this.ctx.fill();

        // Control point 2
        this.ctx.fillStyle = '#44ff44';
        this.ctx.beginPath();
        this.ctx.arc(cp2X, cp2Y, 6, 0, 2 * Math.PI);
        this.ctx.fill();
    }

    handleCanvasMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 20;
        const gridWidth = width - 2 * padding;
        const gridHeight = height - 2 * padding;

        const cp1X = padding + this.controlPoints.cp1.x * gridWidth;
        const cp1Y = height - padding - this.controlPoints.cp1.y * gridHeight;
        const cp2X = padding + this.controlPoints.cp2.x * gridWidth;
        const cp2Y = height - padding - this.controlPoints.cp2.y * gridHeight;

        // Check if mouse is near control points
        const threshold = 10;

        if (Math.abs(mouseX - cp1X) < threshold && Math.abs(mouseY - cp1Y) < threshold) {
            this.isDragging = true;
            this.dragPoint = 'cp1';
        } else if (Math.abs(mouseX - cp2X) < threshold && Math.abs(mouseY - cp2Y) < threshold) {
            this.isDragging = true;
            this.dragPoint = 'cp2';
        }
    }

    handleCanvasMouseMove(e) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const width = this.canvas.width;
        const height = this.canvas.height;
        const padding = 20;
        const gridWidth = width - 2 * padding;
        const gridHeight = height - 2 * padding;

        // Convert mouse coordinates to normalized coordinates
        const normalizedX = Math.max(0, Math.min(1, (mouseX - padding) / gridWidth));
        const normalizedY = Math.max(0, Math.min(1, (height - padding - mouseY) / gridHeight));

        if (this.dragPoint === 'cp1') {
            this.controlPoints.cp1.x = normalizedX;
            this.controlPoints.cp1.y = normalizedY;
            document.getElementById('x1').value = normalizedX.toFixed(2);
            document.getElementById('y1').value = normalizedY.toFixed(2);
        } else if (this.dragPoint === 'cp2') {
            this.controlPoints.cp2.x = normalizedX;
            this.controlPoints.cp2.y = normalizedY;
            document.getElementById('x2').value = normalizedX.toFixed(2);
            document.getElementById('y2').value = normalizedY.toFixed(2);
        } this.updateCanvas();
    }

    handleCanvasMouseUp() {
        this.isDragging = false;
        this.dragPoint = null;
    }

    applyTransition() {
        if (!this.currentObject || !this.currentProperty || !this.currentApp) return;

        // Create or find keyframe at current frame
        if (!this.currentKeyframe) {
            // Create a new keyframe with current value
            const currentValue = this.currentApp.getPropertyValue(this.currentObject, this.currentProperty);
            this.currentApp.setKeyframe(this.currentObject, this.currentProperty, this.currentApp.currentFrame, currentValue);
            this.currentKeyframe = this.findKeyframeAtFrame(this.currentObject, this.currentProperty, this.currentApp.currentFrame);
        }

        if (this.currentKeyframe) {
            // Check if the curve is linear (0,0,1,1) - if so, remove it
            const isLinear = this.controlPoints.cp1.x === 0 && 
                            this.controlPoints.cp1.y === 0 && 
                            this.controlPoints.cp2.x === 1 && 
                            this.controlPoints.cp2.y === 1;

            if (isLinear) {
                // Remove the curve property to make it linear
                delete this.currentKeyframe.curve;
            } else {
                // Apply the custom curve to the keyframe
                this.currentKeyframe.curve = {
                    x1: this.controlPoints.cp1.x,
                    y1: this.controlPoints.cp1.y,
                    x2: this.controlPoints.cp2.x,
                    y2: this.controlPoints.cp2.y
                };
            }

            // Redraw canvas and save state
            this.currentApp.redraw();
            this.currentApp.saveState();
            
            // Update UI to reflect the current state of transition buttons
            this.currentApp.updateRightPanel();
        }

        this.closeModal();
    }

    resetTransition() {
        this.setControlPoints(0, 0, 1, 1);
    }

    updateTransitionButtonState() {
        // Update the visual state of transition buttons to show which have custom curves
        const transitionBtns = document.querySelectorAll('.transition-btn');
        transitionBtns.forEach(btn => {
            const property = btn.dataset.property;
            if (property === this.currentProperty) {
                btn.classList.add('has-curve');
            }
        });
    }
}

// Initialize the transition editor when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.TransitionEditor = new TransitionEditor();
});