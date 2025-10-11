// Enhanced video export with multiple formats and better quality
class ExportManager {
    constructor(app) {
        this.app = app;
        this.isExporting = false;
        this.supportedFormats = this.detectSupportedFormats();
        this.lastSelectedFormat = null; // Remember last selected format for the session
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
            // Show format selection dialog
            const selectedFormat = await this.showFormatSelectionDialog();
            if (!selectedFormat) {
                return; // User cancelled
            }

            this.isExporting = true;
            const loadingOverlay = window.UIManager?.showLoadingOverlay('Preparing export...');

            // Choose export method based on capabilities
            if (this.supportsVideoRecording()) {
                await this.exportWithVideoRecording(selectedFormat);
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

    async showFormatSelectionDialog() {
        return new Promise((resolve) => {
            const modal = document.getElementById('exportFormatModal');
            const formatOptions = document.getElementById('formatOptions');
            const confirmButton = document.getElementById('confirmExport');
            const cancelButton = document.getElementById('cancelExport');
            const closeButton = modal.querySelector('.close');

            // Clear previous options
            formatOptions.innerHTML = '';

            // Define format information
            const formatInfo = {
                'video/webm;codecs=vp9': {
                    name: 'WebM (VP9)',
                    description: 'High quality, good compression, modern browsers'
                },
                'video/webm;codecs=vp8': {
                    name: 'WebM (VP8)',
                    description: 'Good quality, wider browser support'
                },
                'video/mp4;codecs=h264': {
                    name: 'MP4 (H.264)',
                    description: 'Universal compatibility, good quality'
                },
                'video/mp4': {
                    name: 'MP4',
                    description: 'Universal compatibility'
                }
            };

            let selectedFormat = null;

            // Create format options
            const supportedFormatKeys = Object.keys(this.supportedFormats);
            let defaultSelectionMade = false;

            supportedFormatKeys.forEach((format, index) => {
                const info = formatInfo[format] || { name: format, description: 'Standard format' };

                const optionDiv = document.createElement('div');
                optionDiv.className = 'format-option';

                const radio = document.createElement('input');
                radio.type = 'radio';
                radio.name = 'videoFormat';
                radio.value = format;
                radio.id = `format_${index}`;

                const label = document.createElement('label');
                label.htmlFor = `format_${index}`;
                label.className = 'format-info';

                const nameDiv = document.createElement('div');
                nameDiv.className = 'format-name';
                nameDiv.textContent = info.name;

                const descDiv = document.createElement('div');
                descDiv.className = 'format-description';
                descDiv.textContent = info.description;

                label.appendChild(nameDiv);
                label.appendChild(descDiv);

                optionDiv.appendChild(radio);
                optionDiv.appendChild(label);

                // Handle selection
                optionDiv.addEventListener('click', () => {
                    // Clear previous selections
                    document.querySelectorAll('.format-option').forEach(opt => opt.classList.remove('selected'));
                    optionDiv.classList.add('selected');
                    radio.checked = true;
                    selectedFormat = format;
                    confirmButton.disabled = false;
                });

                formatOptions.appendChild(optionDiv);

                // Select last used format if available, otherwise select first option
                const shouldSelect = (this.lastSelectedFormat && format === this.lastSelectedFormat) ||
                    (!this.lastSelectedFormat && index === 0);

                if (shouldSelect && !defaultSelectionMade) {
                    optionDiv.click();
                    defaultSelectionMade = true;
                }
            });

            // Show modal
            modal.style.display = 'flex';

            // Handle buttons
            const handleConfirm = () => {
                // Remember the selected format for this session
                this.lastSelectedFormat = selectedFormat;
                modal.style.display = 'none';
                cleanup();
                resolve(selectedFormat);
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(null);
            };

            const cleanup = () => {
                confirmButton.removeEventListener('click', handleConfirm);
                cancelButton.removeEventListener('click', handleCancel);
                closeButton.removeEventListener('click', handleCancel);
            };

            confirmButton.addEventListener('click', handleConfirm);
            cancelButton.addEventListener('click', handleCancel);
            closeButton.addEventListener('click', handleCancel);
        });
    }

    async exportWithVideoRecording(selectedFormat = null) {
        // Create canvas with absolute pixel dimensions (ignore device pixel ratio for export)
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // No scaling - use absolute pixel dimensions for consistent video output

        // Enable high-quality text rendering
        context.textRenderingOptimization = 'optimizeQuality';
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.textBaseline = 'top';
        context.textAlign = 'left';

        // Use the selected format from the dialog
        if (!selectedFormat) {
            throw new Error('No video format selected');
        }

        if (!this.supportedFormats[selectedFormat]) {
            throw new Error(`Selected format ${selectedFormat} is not supported`);
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
        // Create canvas with absolute pixel dimensions
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Enable high-quality text rendering
        context.textRenderingOptimization = 'optimizeQuality';
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.textBaseline = 'top';
        context.textAlign = 'left';

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
        // Clear canvas with background color (use logical dimensions since context is scaled)
        context.clearRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);
        context.fillStyle = this.app.canvasBackground;
        context.fillRect(0, 0, this.app.canvasWidth, this.app.canvasHeight);

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
            // Get text metrics for proper rotation center with fallback fonts
            let fontString;
            if (this.app.fonts.has(textObject.fontFamily)) {
                fontString = `${props.fontSize}px "${textObject.fontFamily}"`;
            } else {
                fontString = `${props.fontSize}px Arial, sans-serif`;
            }

            context.font = fontString;
            const metrics = context.measureText(textObject.text);
            const centerX = props.x + metrics.width / 2;
            const centerY = props.y + props.fontSize / 2;

            context.translate(centerX, centerY);
            context.rotate((props.rotation * Math.PI) / 180);
            context.translate(-centerX, -centerY);
        }

        // Apply font settings with fallback fonts if needed
        let fontString;
        if (this.app.fonts.has(textObject.fontFamily)) {
            fontString = `${props.fontSize}px "${textObject.fontFamily}"`;
        } else {
            fontString = `${props.fontSize}px Arial, sans-serif`;
        }

        context.font = fontString;
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
        // Create canvas with absolute pixel dimensions
        const canvas = document.createElement('canvas');
        canvas.width = this.app.canvasWidth;
        canvas.height = this.app.canvasHeight;
        const context = canvas.getContext('2d');

        // Enable high-quality text rendering
        context.textRenderingOptimization = 'optimizeQuality';
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        context.textBaseline = 'top';
        context.textAlign = 'left';

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