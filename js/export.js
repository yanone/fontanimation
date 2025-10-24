// Enhanced video export with multiple formats and better quality
class ExportManager {
    constructor(app) {
        this.app = app;
        this.isExporting = false;
        this.exportCancelled = false;
        this.supportedFormats = this.detectSupportedFormats();
        this.lastSelectedFormat = null; // Remember last selected format for the session
    }

    cancelExport() {
        this.exportCancelled = true;

        if (window.UIManager) {
            window.UIManager.createNotification('Export cancelled', 'warning');
            // Hide progress overlay
            const progressOverlay = document.getElementById('exportProgressOverlay');
            if (progressOverlay) {
                progressOverlay.remove();
            }
            // Reset export button
            const exportBtn = document.getElementById('exportBtn');
            if (exportBtn) {
                exportBtn.querySelector('span').textContent = 'Export Video';
                exportBtn.disabled = false;
                exportBtn.style.opacity = '1';
            }
        }

        this.isExporting = false;
    }

    async exportVideo(app) {
        // The app parameter is not needed since we already have this.app
        await this.export();
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
            // Reset cancellation flag
            this.exportCancelled = false;

            // Validate that we have something to export
            if (!this.app.textObjects || this.app.textObjects.length === 0) {
                throw new Error('No text objects to export. Please add some text first.');
            }

            if (!this.app.totalFrames || this.app.totalFrames <= 0) {
                throw new Error('Invalid animation duration. Please check your timeline settings.');
            }

            // Show format selection dialog
            const selectedFormat = await this.showFormatSelectionDialog();
            if (!selectedFormat) {
                return; // User cancelled
            }

            this.isExporting = true;
            if (window.UIManager) {
                window.UIManager.createNotification('Starting export...', 'info');
            }

            // Choose export method based on capabilities
            if (this.supportsVideoRecording()) {
                await this.exportWithVideoRecording(selectedFormat);

                if (window.UIManager) {
                    window.UIManager.createNotification('Video export completed successfully!', 'success');
                }
            } else {
                if (window.UIManager) {
                    window.UIManager.createNotification('Video recording not supported. Exporting as image sequence...', 'info');
                }
                await this.exportWithFrameSequence();
            }

        } catch (error) {
            // Don't show error messages if export was cancelled
            if (this.exportCancelled) {
                return;
            }

            console.error('Export failed:', error);

            let errorMessage = error.message || 'Unknown export error';

            // Provide more helpful error messages
            if (errorMessage.includes('MediaRecorder')) {
                errorMessage += ' Try refreshing the page or using a different browser.';
            } else if (errorMessage.includes('stream')) {
                errorMessage += ' There may be an issue with canvas recording in your browser.';
            } else if (errorMessage.includes('timeout')) {
                errorMessage += ' The export is taking too long. Try reducing the animation duration or quality.';
            }

            if (window.UIManager) {
                window.UIManager.createNotification('Export failed: ' + errorMessage, 'error');

                // Offer to try frame sequence export as fallback
                if (this.supportsVideoRecording() && !error.message?.includes('frame sequence')) {
                    setTimeout(() => {
                        if (confirm('Video export failed. Would you like to try exporting as image frames instead?')) {
                            this.isExporting = false;
                            this.exportWithFrameSequence().catch(seqError => {
                                console.error('Frame sequence export also failed:', seqError);
                                window.UIManager.createNotification('Frame sequence export also failed: ' + seqError.message, 'error');
                            });
                        }
                    }, 1000);
                }
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

            // Add Safari recommendation
            const recommendationDiv = document.createElement('div');
            recommendationDiv.className = 'browser-recommendation';
            recommendationDiv.innerHTML = `
                <div style="margin-top: 15px; padding: 10px; background-color: rgba(255, 193, 7, 0.1); border: 1px solid rgba(255, 193, 7, 0.3); border-radius: 4px; font-size: 14px; color: var(--text-secondary);">
                    <strong>💡 Tip:</strong> For high-resolution animations (4K), use Safari browser when possible. Safari provides more reliable video encoding, especially for high-resolution content.
                </div>
            `;
            formatOptions.appendChild(recommendationDiv);

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
        // Check for canvas size limitations
        const canvasArea = this.app.canvasWidth * this.app.canvasHeight;
        const maxRecommendedArea = 1920 * 1080; // 1080p
        const maxSupportedArea = 3840 * 2160; // 4K

        if (canvasArea > maxSupportedArea) {
            throw new Error(`Canvas size (${this.app.canvasWidth}×${this.app.canvasHeight}) may be too large for video export. Try reducing to 4K (3840×2160) or smaller.`);
        }

        if (canvasArea > maxRecommendedArea && selectedFormat?.includes('mp4')) {
            console.warn('Large canvas size detected. MP4 export may be unstable. Consider using WebM format instead.');
        }

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

        try {
            // Use robust frame-by-frame export with direct MediaRecorder control
            const result = await this.exportFrameByFrame(canvas, context, selectedFormat);

            // Clean up the temporary canvas on success
            if (canvas.parentNode) {
                document.body.removeChild(canvas);
            }

            return result;

        } catch (error) {
            // Clean up the temporary canvas on failure
            if (canvas.parentNode) {
                document.body.removeChild(canvas);
            }

            throw error;
        }
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
        context.textAlign = textObject.textAlign || 'left';

        // Render text with antialiasing
        context.textRenderingOptimization = 'optimizeQuality';
        context.fillText(textObject.text, props.x, props.y);

        // Clean up canvas styles if variable fonts or features were applied
        this.cleanupCanvasStyles(context);

        context.restore();
    }

    cleanupCanvasStyles(context) {
        const canvas = context.canvas;

        // Clean up font feature styles (both variable axes and OpenType features)
        if (this._originalExportCanvasStyles) {
            canvas.style.fontFamily = this._originalExportCanvasStyles.fontFamily || '';
            canvas.style.fontVariationSettings = this._originalExportCanvasStyles.fontVariationSettings || '';
            canvas.style.fontFeatureSettings = this._originalExportCanvasStyles.fontFeatureSettings || '';
            canvas.style.fontSize = '';
            delete this._originalExportCanvasStyles;
        }
    }

    applyFontFeatures(textObject, props, context) {
        try {
            console.log('Export: applyFontFeatures called with features:', {
                variableAxes: props.variableAxes,
                openTypeFeatures: props.openTypeFeatures
            });

            // Apply both variable axes and OpenType features using unified approach
            const hasVariableAxes = props.variableAxes && Object.keys(props.variableAxes).length > 0;
            const hasOpenTypeFeatures = props.openTypeFeatures && Object.keys(props.openTypeFeatures).length > 0;

            if (hasVariableAxes || hasOpenTypeFeatures) {
                this.applyFontFeaturesToCanvas(textObject.fontFamily, props.fontSize, props.variableAxes, props.openTypeFeatures, context);
            } else {
                console.log('Export: No font features found, setting basic font');
                context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
            }
        } catch (error) {
            console.warn('Failed to apply font features in export:', error);
            // Fallback to basic font
            context.font = `${props.fontSize}px "${textObject.fontFamily}"`;
        }
    }

    // Apply font features (variable axes and OpenType features) to canvas context for export
    applyFontFeaturesToCanvas(fontFamily, fontSize, variableAxes = {}, openTypeFeatures = {}, context) {
        try {
            const canvas = context.canvas;
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

            console.log('Export: Applying font features:', {
                fontVariationSettings,
                fontFeatureSettings
            });

            // Apply font settings to the canvas element
            canvas.style.fontFamily = `"${fontFamily}"`;
            if (fontVariationSettings) {
                canvas.style.fontVariationSettings = fontVariationSettings;
            }
            if (fontFeatureSettings) {
                canvas.style.fontFeatureSettings = fontFeatureSettings;
            }
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
                fontVariationSettings: originalFontVariationSettings,
                fontFeatureSettings: originalFontFeatureSettings
            };

        } catch (error) {
            console.warn('Export: Failed to apply font features to canvas:', error);
            // Fallback to basic font
            context.font = `${fontSize}px "${fontFamily}"`;
        }
    }

    async renderAnimationToCanvas(canvas, context, onComplete) {
        const frameInterval = 1000 / this.app.frameRate;
        let frame = 0;
        let startTime = performance.now();

        // Chrome-specific optimizations for large canvases
        const canvasArea = canvas.width * canvas.height;
        const is4K = canvasArea >= 3840 * 2160;
        const isLarge = canvasArea >= 2560 * 1440;

        if (this.isChrome && is4K) {
            console.log('Chrome detected with 4K canvas - using browser-synced rendering to prevent frame drops');
        }

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

            // Schedule next frame
            if (frame < this.app.totalFrames) {
                const nextFrameTime = startTime + (frame * frameInterval);
                const delay = Math.max(0, nextFrameTime - performance.now());

                // Use requestAnimationFrame for Chrome with large canvases for better sync
                if (this.isChrome && (is4K || isLarge)) {
                    // For Chrome with large canvases, use requestAnimationFrame but still respect timing
                    if (delay > 0) {
                        setTimeout(() => requestAnimationFrame(renderNextFrame), delay);
                    } else {
                        requestAnimationFrame(renderNextFrame);
                    }
                } else {
                    // Standard timeout-based rendering for other cases
                    setTimeout(renderNextFrame, delay);
                }
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

    // Robust frame-by-frame video export with direct MediaRecorder control
    async exportFrameByFrame(canvas, context, selectedFormat) {
        return new Promise(async (resolve, reject) => {
            try {
                console.log('Starting robust frame-by-frame video export...');

                // Create MediaRecorder with the original canvas
                const stream = canvas.captureStream(0); // 0 = manual frame capture

                // Calculate appropriate bitrate
                const canvasArea = canvas.width * canvas.height;
                const baseArea = 1920 * 1080;
                const areaRatio = Math.min(canvasArea / baseArea, 4);
                const baseBitrate = selectedFormat.includes('mp4') ? 12000000 : 10000000;
                const bitrate = Math.floor(baseBitrate * Math.sqrt(areaRatio));

                const mediaRecorderOptions = {
                    mimeType: selectedFormat,
                    videoBitsPerSecond: Math.min(bitrate, 20000000) // Conservative cap for stability
                };

                console.log(`MediaRecorder settings: ${canvas.width}x${canvas.height}, ${(bitrate / 1000000).toFixed(1)}Mbps, ${this.app.frameRate}fps`);

                const mediaRecorder = new MediaRecorder(stream, mediaRecorderOptions);
                const recordedChunks = [];

                mediaRecorder.ondataavailable = (event) => {
                    if (event.data.size > 0) {
                        recordedChunks.push(event.data);
                    }
                };

                mediaRecorder.onstop = () => {
                    console.log(`Recording stopped. Total chunks: ${recordedChunks.length}`);

                    // Don't download if export was cancelled
                    if (this.exportCancelled) {
                        console.log('Export was cancelled, not downloading video');
                        resolve(); // Resolve quietly without error
                        return;
                    }

                    const blob = new Blob(recordedChunks, { type: selectedFormat });
                    const extension = selectedFormat.includes('mp4') ? 'mp4' : 'webm';
                    this.downloadBlob(blob, `animation.${extension}`);
                    resolve();
                };

                mediaRecorder.onerror = (error) => {
                    console.error('MediaRecorder error:', error);
                    reject(error);
                };

                // Start recording with small chunks
                mediaRecorder.start(100);
                console.log('MediaRecorder started, beginning frame rendering...');

                // Render frames with precise timing
                const totalFrames = this.app.totalFrames;
                const frameDuration = 1000 / this.app.frameRate; // Duration per frame in ms

                for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
                    // Check for cancellation
                    if (this.exportCancelled) {
                        console.log('Export cancelled, stopping MediaRecorder...');
                        if (mediaRecorder.state === 'recording') {
                            mediaRecorder.stop();
                        }
                        // Don't reject, just return - onstop will handle the quiet resolution
                        return;
                    }

                    // Clear and render frame
                    context.clearRect(0, 0, canvas.width, canvas.height);
                    context.fillStyle = this.app.canvasBackground;
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    this.renderFrame(frameIndex, canvas, context);

                    // Capture this frame in the stream (this is the key!)
                    const track = stream.getVideoTracks()[0];
                    if (track && track.requestFrame) {
                        track.requestFrame();
                    }

                    // Update progress
                    const progress = (frameIndex + 1) / totalFrames;
                    if (window.UIManager) {
                        window.UIManager.showExportProgress(progress, this);
                    }

                    console.log(`Rendered frame ${frameIndex + 1}/${totalFrames}`);

                    // Wait for the exact frame duration to maintain proper timing
                    await new Promise(resolve => setTimeout(resolve, frameDuration));
                }

                console.log(`All ${totalFrames} frames rendered. Finalizing video...`);

                // Wait a bit then stop recording
                setTimeout(() => {
                    if (mediaRecorder.state === 'recording') {
                        mediaRecorder.stop();
                    }
                }, 500);

            } catch (error) {
                console.error('Frame-by-frame export failed:', error);
                reject(error);
            }
        });
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

// Make ExportManager available globally with lazy initialization
window.ExportManager = null;

// Initialize ExportManager when needed
function getExportManager() {
    if (!window.ExportManager && window.app) {
        window.ExportManager = new ExportManager(window.app);
    }
    return window.ExportManager;
}

// Make the getter available globally  
window.getExportManager = getExportManager;