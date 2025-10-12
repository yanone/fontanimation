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
            // Store resolve function globally for Escape key handling
            window.currentExportPromise = { resolve };
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
                // Clear global promise reference
                window.currentExportPromise = null;
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

        // Add canvas to DOM temporarily for CSS styles to work (needed for variable fonts)
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        canvas.style.top = '-9999px';
        canvas.style.visibility = 'hidden';
        document.body.appendChild(canvas);

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

        // Create video stream with desired frame rate
        const stream = canvas.captureStream(this.app.frameRate);

        // Configure MediaRecorder with proper options
        const mediaRecorderOptions = {
            mimeType: selectedFormat,
            videoBitsPerSecond: 5000000 // 5 Mbps
        };

        // For MP4, try to use a more compatible configuration
        if (selectedFormat.includes('mp4')) {
            // Request keyframe every second for better compatibility
            mediaRecorderOptions.videoBitsPerSecond = 8000000; // Higher bitrate for MP4
        }

        const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
        const chunks = [];

        mediaRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                chunks.push(event.data);
                console.log(`Data chunk received: ${event.data.size} bytes`);
            }
        };

        return new Promise((resolve, reject) => {
            mediaRecorder.onstop = () => {
                console.log(`Total chunks collected: ${chunks.length}`);
                if (chunks.length === 0) {
                    reject(new Error('No video data was recorded. Please try again.'));
                    return;
                }

                const blob = new Blob(chunks, { type: selectedFormat });
                console.log(`Final blob size: ${blob.size} bytes`);

                if (blob.size < 1000) { // Less than 1KB is likely invalid
                    reject(new Error('Video file appears to be invalid. Please try exporting again.'));
                    return;
                }

                const extension = selectedFormat.includes('mp4') ? 'mp4' : 'webm';
                this.downloadBlob(blob, `animation.${extension}`);

                // Clean up the temporary canvas
                if (canvas.parentNode) {
                    document.body.removeChild(canvas);
                }

                resolve();
            };

            mediaRecorder.onerror = (error) => {
                console.error('MediaRecorder error:', error);

                // Clean up the temporary canvas on error
                if (canvas.parentNode) {
                    document.body.removeChild(canvas);
                }

                reject(new Error('MediaRecorder error: ' + (error.message || 'Unknown error')));
            };

            mediaRecorder.onstart = () => {
                console.log('MediaRecorder started with format:', selectedFormat);
            };

            // Wait a bit before starting recording to ensure stream is ready
            setTimeout(() => {
                try {
                    // Request data every 100ms for better MP4 compatibility
                    mediaRecorder.start(100);

                    // Start rendering animation after a brief delay
                    setTimeout(() => {
                        this.renderAnimationToCanvas(canvas, context, () => {
                            // Wait longer before stopping, especially for MP4
                            const stopDelay = selectedFormat.includes('mp4') ? 1000 : 500;
                            setTimeout(() => {
                                if (mediaRecorder.state === 'recording') {
                                    mediaRecorder.stop();
                                }
                            }, stopDelay);
                        });
                    }, 100);
                } catch (error) {
                    reject(new Error('Failed to start recording: ' + error.message));
                }
            }, 100);
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

        // Add canvas to DOM temporarily for CSS styles to work (needed for variable fonts)
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        canvas.style.top = '-9999px';
        canvas.style.visibility = 'hidden';
        document.body.appendChild(canvas);

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

        // Clean up the temporary canvas
        if (canvas.parentNode) {
            document.body.removeChild(canvas);
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

        console.log('Export: Rendering text object at frame', frame, 'with props:', {
            x: props.x,
            y: props.y,
            fontSize: props.fontSize,
            color: props.color,
            variableAxes: props.variableAxes
        });

        context.save();

        // Apply rotation if present
        if (props.rotation && props.rotation !== 0) {
            // Set up temporary font for measuring (will be properly set later with variable axes)
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

        // Apply font settings with variable axes and features
        if (this.app.fonts.has(textObject.fontFamily)) {
            console.log('Export: Font available, applying font features for', textObject.fontFamily);
            // Apply variable font settings if available
            this.applyFontFeatures(textObject, props, context);
        } else {
            console.log('Export: Font not available, using fallback for', textObject.fontFamily);
            // Use fallback font when the desired font is not available
            context.font = `${props.fontSize}px Arial, sans-serif`;
        }

        context.fillStyle = props.color;
        context.textBaseline = 'top';

        // Render text with antialiasing
        context.textRenderingOptimization = 'optimizeQuality';
        context.fillText(textObject.text, props.x, props.y);

        // Clean up canvas styles if variable fonts or features were applied
        this.cleanupCanvasStyles(context);

        context.restore();
    }

    cleanupCanvasStyles(context) {
        const canvas = context.canvas;

        // Clean up variable font styles
        if (this._originalExportCanvasStyles) {
            canvas.style.fontFamily = this._originalExportCanvasStyles.fontFamily || '';
            canvas.style.fontVariationSettings = this._originalExportCanvasStyles.fontVariationSettings || '';
            canvas.style.fontSize = '';
            delete this._originalExportCanvasStyles;
        }

        // Clean up OpenType feature styles
        if (this._originalCanvasFeatureSettings !== undefined) {
            canvas.style.fontFeatureSettings = this._originalCanvasFeatureSettings || '';
            delete this._originalCanvasFeatureSettings;
        }
    }

    applyFontFeatures(textObject, props, context) {
        try {
            console.log('Export: applyFontFeatures called with variable axes:', props.variableAxes);

            // Apply variable axes using the same reliable method as the main app
            if (props.variableAxes && Object.keys(props.variableAxes).length > 0) {
                console.log('Export: Applying variable axes:', Object.keys(props.variableAxes));
                this.applyVariableFontToCanvas(textObject.fontFamily, props.fontSize, props.variableAxes, context);
            } else {
                console.log('Export: No variable axes found, setting basic font');
                // Set basic font if no variable axes
                context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
            }

            // Apply OpenType features if present
            if (props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0) {
                // For OpenType features, we still need the DOM approach as Canvas doesn't support font-feature-settings directly
                const canvas = context.canvas;
                const features = Object.entries(props.openTypeFeatures)
                    .filter(([tag, enabled]) => enabled)
                    .map(([tag]) => `"${tag}" 1`)
                    .join(', ');

                if (features) {
                    const originalFontFeatureSettings = canvas.style.fontFeatureSettings;
                    canvas.style.fontFeatureSettings = features;

                    // Re-apply font with features
                    context.font = `${props.fontSize}px "${textObject.fontFamily}"`;

                    // Store for cleanup
                    this._originalCanvasFeatureSettings = originalFontFeatureSettings;
                }
            }
        } catch (error) {
            console.warn('Failed to apply font features in export:', error);
            // Fallback to basic font
            context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
        }
    }

    // Apply variable font settings to canvas context (enhanced approach for export)
    applyVariableFontToCanvas(fontFamily, fontSize, variableAxes, context) {
        try {
            // Create font-variation-settings string
            let fontVariationSettings = '';
            Object.entries(variableAxes).forEach(([tag, value]) => {
                fontVariationSettings += `"${tag}" ${value}, `;
            });
            fontVariationSettings = fontVariationSettings.replace(/, $/, '');

            console.log('Export: Applying font variation settings:', fontVariationSettings);

            // Try multiple approaches for better compatibility

            // Approach 1: CSS on canvas element (original approach)
            const canvas = context.canvas;
            const originalFontFamily = canvas.style.fontFamily;
            const originalFontVariationSettings = canvas.style.fontVariationSettings;

            canvas.style.fontFamily = `"${fontFamily}"`;
            canvas.style.fontVariationSettings = fontVariationSettings;
            canvas.style.fontSize = `${fontSize}px`;

            // Approach 2: Try using FontFace API for more reliable font loading
            if (window.FontFace && !this._exportFontCache) {
                this._exportFontCache = new Map();
            }

            const cacheKey = `${fontFamily}-${fontVariationSettings}`;
            if (this._exportFontCache && !this._exportFontCache.has(cacheKey)) {
                try {
                    // Create a font face with variable settings
                    const uniqueFontName = `${fontFamily}-export-${Date.now()}`;
                    const fontFace = new FontFace(uniqueFontName, `local("${fontFamily}")`, {
                        fontVariationSettings: fontVariationSettings
                    });

                    // Load the font and add it to document fonts
                    fontFace.load().then(() => {
                        document.fonts.add(fontFace);
                        this._exportFontCache.set(cacheKey, uniqueFontName);
                        console.log('Export: Added font face:', uniqueFontName);
                    }).catch(err => {
                        console.warn('Export: FontFace load failed:', err);
                        this._exportFontCache.set(cacheKey, fontFamily);
                    });

                    // Use the unique font name
                    context.font = `${fontSize}px "${uniqueFontName}", "${fontFamily}"`;
                    this._exportFontCache.set(cacheKey, uniqueFontName);
                } catch (fontFaceError) {
                    console.warn('Export: FontFace API not supported or failed:', fontFaceError);
                    // Fall back to canvas CSS approach
                    context.font = `${fontSize}px "${fontFamily}"`;
                }
            } else if (this._exportFontCache && this._exportFontCache.has(cacheKey)) {
                // Use cached font
                const cachedFontName = this._exportFontCache.get(cacheKey);
                context.font = `${fontSize}px "${cachedFontName}", "${fontFamily}"`;
            } else {
                // Standard canvas CSS approach
                context.font = `${fontSize}px "${fontFamily}"`;
            }

            // Store original styles for cleanup
            this._originalExportCanvasStyles = {
                fontFamily: originalFontFamily,
                fontVariationSettings: originalFontVariationSettings
            };

        } catch (error) {
            console.warn('Export: Failed to apply variable font settings to canvas:', error);
            // Fallback to basic font
            context.font = `${fontSize}px "${fontFamily}"`;
        }
    }

    async renderAnimationToCanvas(canvas, context, onComplete) {
        const frameInterval = 1000 / this.app.frameRate;
        let frame = 0;
        let startTime = performance.now();

        const renderNextFrame = (currentTime) => {
            if (frame >= this.app.totalFrames) {
                const actualDuration = (performance.now() - startTime) / 1000;
                const expectedDuration = this.app.totalFrames / this.app.frameRate;
                console.log(`Animation rendering complete. Total frames: ${frame}`);
                console.log(`Actual duration: ${actualDuration.toFixed(2)}s, Expected: ${expectedDuration.toFixed(2)}s`);
                onComplete();
                return;
            }

            // Clear canvas before rendering each frame
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Set background
            context.fillStyle = this.app.canvasBackground;
            context.fillRect(0, 0, canvas.width, canvas.height);

            this.renderFrame(frame, canvas, context);
            frame++;

            // Update progress
            const progress = frame / this.app.totalFrames;
            if (window.UIManager) {
                window.UIManager.showExportProgress(progress);
            }

            // Calculate when the next frame should be rendered
            if (frame < this.app.totalFrames) {
                const nextFrameTime = startTime + (frame * frameInterval);
                const delay = Math.max(0, nextFrameTime - performance.now());

                setTimeout(renderNextFrame, delay);
            } else {
                onComplete();
            }
        };

        // Start rendering immediately
        renderNextFrame(startTime);
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

        // Add canvas to DOM temporarily for CSS styles to work (needed for variable fonts)
        canvas.style.position = 'absolute';
        canvas.style.left = '-9999px';
        canvas.style.top = '-9999px';
        canvas.style.visibility = 'hidden';
        document.body.appendChild(canvas);

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

            // Clean up the temporary canvas
            if (canvas.parentNode) {
                document.body.removeChild(canvas);
            }
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