// Enhanced Animation playback with smooth interpolation
class AnimationManager {
    constructor(app) {
        this.app = app;
        this.animationFrame = null;
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / this.app.frameRate;
        this.isLooping = false; // Don't loop by default
    }

    static togglePlayback(app) {
        if (!app.animationManager) {
            app.animationManager = new AnimationManager(app);
        }

        if (app.isPlaying) {
            app.animationManager.pause();
        } else {
            app.animationManager.play();
        }
    }

    play() {
        this.app.isPlaying = true;
        this.lastFrameTime = performance.now();
        this.frameInterval = 1000 / this.app.frameRate;

        if (window.UIManager) {
            window.UIManager.updatePlayButton(true);
        }

        this.animate();
    }

    pause() {
        this.app.isPlaying = false;

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
            this.animationFrame = null;
        }

        if (window.UIManager) {
            window.UIManager.updatePlayButton(false);
        }
    }

    animate() {
        if (!this.app.isPlaying) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastFrameTime;

        if (deltaTime >= this.frameInterval) {
            this.advanceFrame();
            this.lastFrameTime = currentTime - (deltaTime % this.frameInterval);
        }

        this.animationFrame = requestAnimationFrame(() => this.animate());
    }

    advanceFrame() {
        this.app.currentFrame++;

        if (this.app.currentFrame >= this.app.totalFrames) {
            if (this.isLooping) {
                this.app.currentFrame = 0;
            } else {
                this.app.currentFrame = this.app.totalFrames - 1;
                this.pause();
            }
        }

        // Update timeline cursor
        if (this.app.timeline) {
            this.app.timeline.updateCursor();
        }

        // Update frame and time display
        this.app.updateFrameTimeDisplay();

        // Redraw canvas with new frame
        this.app.redraw();
    }

    seekToFrame(frame) {
        this.app.currentFrame = Math.max(0, Math.min(frame, this.app.totalFrames - 1));

        if (this.app.timeline) {
            this.app.timeline.updateCursor();
        }

        // Update frame and time display
        this.app.updateFrameTimeDisplay();

        this.app.redraw();
    }

    getFrameRate() {
        return this.app.frameRate;
    }

    setFrameRate(fps) {
        this.app.frameRate = fps;
        this.frameInterval = 1000 / fps;
        this.app.totalFrames = Math.ceil(this.app.duration * fps);

        if (this.app.timeline) {
            this.app.timeline.update();
        }
    }

    getDuration() {
        return this.app.duration;
    }

    setDuration(seconds) {
        this.app.duration = seconds;
        this.app.totalFrames = Math.ceil(seconds * this.app.frameRate);

        if (this.app.currentFrame >= this.app.totalFrames) {
            this.app.currentFrame = this.app.totalFrames - 1;
        }

        if (this.app.timeline) {
            this.app.timeline.update();
        }
    }

    // Enhanced frame rendering with better text rendering
    renderFrame(frame, canvas, context) {
        const previousFrame = this.app.currentFrame;
        this.app.currentFrame = frame;

        // Clear canvas with background color
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = this.app.canvasBackground;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render all text objects at this frame
        this.app.textObjects.forEach(obj => {
            this.renderTextObjectAtFrame(obj, frame, context);
        });

        // Restore previous frame
        this.app.currentFrame = previousFrame;
    }

    renderTextObjectAtFrame(textObject, frame, context) {
        const props = this.app.getObjectPropertiesAtFrame(textObject, frame);

        context.save();

        // Apply rotation if present
        if (props.rotation && props.rotation !== 0) {
            // Calculate text dimensions for rotation center
            context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
            const metrics = context.measureText(textObject.text);
            const centerX = props.x + metrics.width / 2;
            const centerY = props.y + props.fontSize / 2;

            context.translate(centerX, centerY);
            context.rotate((props.rotation * Math.PI) / 180);
            context.translate(-centerX, -centerY);
        }

        // Set basic font properties
        context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
        context.fillStyle = props.color;
        context.textBaseline = 'top';

        // Apply font features using DOM element for better rendering
        if (this.app.fontManager && this.app.fonts.has(textObject.fontFamily)) {
            this.renderTextWithFeatures(textObject, props, context);
        } else {
            context.fillText(textObject.text, props.x, props.y);
        }

        context.restore();
    }

    renderTextWithFeatures(textObject, props, context) {
        // For better OpenType feature support, we create a DOM element
        // and then draw it to canvas using HTML5 canvas methods

        const tempElement = document.createElement('div');
        tempElement.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            font-size: ${props.fontSize}px;
            font-family: "${textObject.fontFamily}";
            color: ${props.color};
            white-space: nowrap;
            pointer-events: none;
        `;

        // Apply variable axes
        if (props.variableAxes && Object.keys(props.variableAxes).length > 0) {
            const variations = Object.entries(props.variableAxes)
                .map(([tag, value]) => `"${tag}" ${value}`)
                .join(', ');
            tempElement.style.fontVariationSettings = variations;
        }

        // Apply OpenType features
        if (props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0) {
            const features = Object.entries(props.openTypeFeatures)
                .filter(([tag, enabled]) => enabled)
                .map(([tag]) => `"${tag}" 1`)
                .join(', ');
            if (features) {
                tempElement.style.fontFeatureSettings = features;
            }
        }

        tempElement.textContent = textObject.text;
        document.body.appendChild(tempElement);

        // Get computed styles and apply to canvas
        const computedStyle = window.getComputedStyle(tempElement);
        context.font = computedStyle.font || context.font;

        // Render the text
        context.fillText(textObject.text, props.x, props.y);

        // Clean up
        document.body.removeChild(tempElement);
    }

    // Export animation frames as image data
    async exportFrames(onProgress = null) {
        const frames = [];
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Enable high-quality text rendering
        context.textRenderingOptimization = 'optimizeQuality';
        context.textRendering = 'geometricPrecision';

        for (let frame = 0; frame < this.app.totalFrames; frame++) {
            // Render frame
            this.renderFrame(frame, canvas, context);

            // Convert to blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/png', 1.0);
            });

            frames.push(blob);

            // Report progress
            if (onProgress) {
                onProgress(frame / this.app.totalFrames);
            }

            // Allow UI updates
            if (frame % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 1));
            }
        }

        return frames;
    }

    // Step controls
    stepForward() {
        if (this.app.currentFrame < this.app.totalFrames - 1) {
            this.seekToFrame(this.app.currentFrame + 1);
        }
    }

    stepBackward() {
        if (this.app.currentFrame > 0) {
            this.seekToFrame(this.app.currentFrame - 1);
        }
    }

    goToStart() {
        this.seekToFrame(0);
    }

    goToEnd() {
        this.seekToFrame(this.app.totalFrames - 1);
    }

    // Playback settings
    setLooping(loop) {
        this.isLooping = loop;
    }

    isLooping() {
        return this.isLooping;
    }

    // Performance optimization for smooth playback
    optimizeForPlayback() {
        // Pre-calculate interpolations for smoother playback
        this.interpolationCache = new Map();

        this.app.textObjects.forEach(obj => {
            const objectInterpolations = [];

            for (let frame = 0; frame < this.app.totalFrames; frame++) {
                const props = this.app.getObjectPropertiesAtFrame(obj, frame);
                objectInterpolations[frame] = props;
            }

            this.interpolationCache.set(obj.id, objectInterpolations);
        });
    }

    clearOptimizations() {
        if (this.interpolationCache) {
            this.interpolationCache.clear();
        }
    }

    // Get cached properties if available, otherwise calculate
    getCachedObjectProperties(obj, frame) {
        if (this.interpolationCache && this.interpolationCache.has(obj.id)) {
            return this.interpolationCache.get(obj.id)[frame];
        }
        return this.app.getObjectPropertiesAtFrame(obj, frame);
    }
}

// Make AnimationManager available globally
window.AnimationManager = AnimationManager;