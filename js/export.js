// Enhanced video export with multiple formats and better quality
class ExportManager {
    constructor(app) {
        this.app = app;
        this.isExporting = false;
        this.supportedFormats = this.detectSupportedFormats();
    }

    static async exportVideo(app) {
        if (!app.exportManager) {
            app.exportManager = new ExportManager(app);
        }

        await app.exportManager.export();
    }

    detectSupportedFormats() {
        const formats = {};

        if (typeof MediaRecorder !== 'undefined') {
            // Test common video formats
            const testFormats = [
                'video/webm;codecs=vp9',
                'video/webm;codecs=vp8',
                'video/mp4;codecs=h264',
                'video/mp4'
            ];

            testFormats.forEach(format => {
                if (MediaRecorder.isTypeSupported(format)) {
                    formats[format] = true;
                }
            });
        }

        return formats;
    }

    async export() {
        if (this.isExporting) {
            if (window.UIManager) {
                window.UIManager.createNotification('Export already in progress', 'warning');
            }
            return;
        }

        try {
            this.isExporting = true;

            const loadingOverlay = window.UIManager?.showLoadingOverlay('Preparing export...');

            // Choose export method based on capabilities
            if (this.supportsVideoRecording()) {
                await this.exportWithVideoRecording();
            } else {
                await this.exportWithFrameSequence();
            }

            if (loadingOverlay) {
                window.UIManager.hideLoadingOverlay();
            }

        } catch (error) {
            console.error('Export failed:', error);
            if (window.UIManager) {
                window.UIManager.createNotification('Export failed: ' + error.message, 'error');
                window.UIManager.hideLoadingOverlay();
            }
        } finally {
            this.isExporting = false;
            if (window.UIManager) {
                window.UIManager.showExportProgress(1);
            }
        }
    }

    supportsVideoRecording() {
        return typeof MediaRecorder !== 'undefined' &&
            HTMLCanvasElement.prototype.captureStream &&
            Object.keys(this.supportedFormats).length > 0;
    }

    async exportWithVideoRecording() {
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Choose best available format
        const preferredFormats = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/mp4;codecs=h264',
            'video/mp4'
        ];

        let selectedFormat = null;
        for (const format of preferredFormats) {
            if (this.supportedFormats[format]) {
                selectedFormat = format;
                break;
            }
        }

        if (!selectedFormat) {
            throw new Error('No supported video format found');
        }

        // Create video stream
        const stream = canvas.captureStream(this.app.frameRate);
        const mediaRecorder = new MediaRecorder(stream, {
            mimeType: selectedFormat,
            videoBitsPerSecond: 5000000 // 5 Mbps
        });

        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                chunks.push(event.data);
            }
        };

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: selectedFormat });
                const extension = selectedFormat.includes('mp4') ? 'mp4' : 'webm';
                this.downloadBlob(blob, `animation.${extension}`);
                resolve();
            };

            mediaRecorder.onerror = (error) => {
                reject(new Error('MediaRecorder error: ' + error.message));
            };

            // Start recording
            mediaRecorder.start();

            // Render animation frames
            this.renderAnimationToCanvas(canvas, context, () => {
                // Add a small delay before stopping to ensure all frames are captured
                setTimeout(() => {
                    mediaRecorder.stop();
                }, 500);
            });
        });
    }

    async exportWithFrameSequence() {
        if (window.UIManager) {
            window.UIManager.createNotification('Exporting as image sequence...', 'info');
        }

        const frames = [];
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Enable high-quality rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        // Render all frames
        for (let frame = 0; frame < this.app.totalFrames; frame++) {
            this.renderFrame(frame, canvas, context);

            // Convert to data URL
            const dataURL = canvas.toDataURL('image/png', 1.0);
            frames.push({
                frame: frame,
                dataURL: dataURL
            });

            // Update progress
            const progress = frame / this.app.totalFrames;
            if (window.UIManager) {
                window.UIManager.showExportProgress(progress);
            }

            // Allow UI updates every 10 frames
            if (frame % 10 === 0) {
                await this.sleep(1);
            }
        }

        // Create zip file if JSZip is available
        if (typeof JSZip !== 'undefined') {
            await this.createZipSequence(frames);
        } else {
            // Export individual frames
            await this.exportIndividualFrames(frames);
        }
    }

    renderFrame(frame, canvas, context) {
        // Clear canvas with background color
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.fillStyle = this.app.canvasBackground;
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Render all text objects at this frame
        this.app.textObjects.forEach(obj => {
            this.renderTextObjectAtFrame(obj, frame, context);
        });
    }

    renderTextObjectAtFrame(textObject, frame, context) {
        const props = this.app.getObjectPropertiesAtFrame(textObject, frame);

        context.save();

        // Apply rotation if present
        if (props.rotation && props.rotation !== 0) {
            // Get text metrics for proper rotation center
            context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
            const metrics = context.measureText(textObject.text);
            const centerX = props.x + metrics.width / 2;
            const centerY = props.y + props.fontSize / 2;

            context.translate(centerX, centerY);
            context.rotate((props.rotation * Math.PI) / 180);
            context.translate(-centerX, -centerY);
        }

        // Apply font settings
        context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
        context.fillStyle = props.color;
        context.textBaseline = 'top';

        // Apply variable font settings if available
        if (this.app.fontManager && this.app.fonts.has(textObject.fontFamily)) {
            this.applyFontFeatures(textObject, props, context);
        }

        // Render text with antialiasing
        context.textRenderingOptimization = 'optimizeQuality';
        context.fillText(textObject.text, props.x, props.y);

        context.restore();
    }

    applyFontFeatures(textObject, props, context) {
        // Create temporary element to apply CSS font features
        const tempElement = document.createElement('div');
        tempElement.style.cssText = `
            position: absolute;
            left: -9999px;
            top: -9999px;
            font-size: ${props.fontSize}px;
            font-family: "${textObject.fontFamily}";
            white-space: nowrap;
            visibility: hidden;
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

        // Apply computed font to canvas context
        const computedStyle = window.getComputedStyle(tempElement);
        if (computedStyle.font) {
            context.font = computedStyle.font;
        }

        document.body.removeChild(tempElement);
    }

    async renderAnimationToCanvas(canvas, context, onComplete) {
        const frameInterval = 1000 / this.app.frameRate;
        let frame = 0;

        const renderNextFrame = () => {
            if (frame >= this.app.totalFrames) {
                onComplete();
                return;
            }

            this.renderFrame(frame, canvas, context);
            frame++;

            // Update progress
            const progress = frame / this.app.totalFrames;
            if (window.UIManager) {
                window.UIManager.showExportProgress(progress);
            }

            setTimeout(renderNextFrame, frameInterval);
        };

        renderNextFrame();
    }

    async createZipSequence(frames) {
        const zip = new JSZip();
        const folder = zip.folder('animation_frames');

        frames.forEach((frameData, index) => {
            const base64Data = frameData.dataURL.split(',')[1];
            const frameNumber = index.toString().padStart(4, '0');
            folder.file(`frame_${frameNumber}.png`, base64Data, { base64: true });
        });

        // Add metadata file
        const metadata = {
            totalFrames: this.app.totalFrames,
            frameRate: this.app.frameRate,
            duration: this.app.duration,
            canvasWidth: this.app.canvasWidth,
            canvasHeight: this.app.canvasHeight,
            canvasBackground: this.app.canvasBackground,
            exported: new Date().toISOString()
        };

        folder.file('metadata.json', JSON.stringify(metadata, null, 2));

        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 }
        });

        this.downloadBlob(zipBlob, 'animation_frames.zip');

        if (window.UIManager) {
            window.UIManager.createNotification(`Exported ${frames.length} frames as ZIP`, 'success');
        }
    }

    async exportIndividualFrames(frames) {
        // Export first few frames as samples
        const samplesToExport = Math.min(5, frames.length);

        for (let i = 0; i < samplesToExport; i++) {
            const frameData = frames[i];
            const link = document.createElement('a');
            link.download = `frame_${i.toString().padStart(4, '0')}.png`;
            link.href = frameData.dataURL;
            link.click();

            // Small delay between downloads
            await this.sleep(100);
        }

        if (window.UIManager) {
            window.UIManager.createNotification(`Exported ${samplesToExport} sample frames`, 'info');
        }
    }

    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Clean up object URL after a delay
        setTimeout(() => URL.revokeObjectURL(url), 1000);

        if (window.UIManager) {
            window.UIManager.createNotification(`Downloaded: ${filename}`, 'success');
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Export single frame as image
    exportCurrentFrame() {
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Enable high-quality rendering
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';

        this.renderFrame(this.app.currentFrame, canvas, context);

        canvas.toBlob((blob) => {
            const frameNumber = this.app.currentFrame.toString().padStart(4, '0');
            this.downloadBlob(blob, `frame_${frameNumber}.png`);
        }, 'image/png', 1.0);
    }

    // Get export settings for different quality levels
    getExportSettings(quality = 'high') {
        const settings = {
            low: {
                scale: 0.5,
                framerate: 15,
                bitrate: 1000000, // 1 Mbps
                format: 'video/webm;codecs=vp8'
            },
            medium: {
                scale: 0.75,
                framerate: 24,
                bitrate: 2500000, // 2.5 Mbps
                format: 'video/webm;codecs=vp8'
            },
            high: {
                scale: 1.0,
                framerate: 30,
                bitrate: 5000000, // 5 Mbps
                format: 'video/webm;codecs=vp9'
            },
            ultra: {
                scale: 1.0,
                framerate: 60,
                bitrate: 10000000, // 10 Mbps
                format: 'video/webm;codecs=vp9'
            }
        };

        return settings[quality] || settings.high;
    }

    // Check export capabilities
    getCapabilities() {
        return {
            videoRecording: this.supportsVideoRecording(),
            supportedFormats: Object.keys(this.supportedFormats),
            canExportFrameSequence: true,
            canExportZip: typeof JSZip !== 'undefined'
        };
    }
}

// Make ExportManager available globally
window.ExportManager = ExportManager;