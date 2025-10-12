// Enhanced UI management with better OpenType feature handling
class UIManager {
    static updateRightPanel(app) {
        const textProperties = document.getElementById('textProperties');

        if (app.selectedObject) {
            textProperties.style.display = 'block';
            UIManager.updateTextProperties(app.selectedObject, app);
        } else {
            textProperties.style.display = 'none';
        }
    }

    static updateTextProperties(textObject, app) {
        // Update font select
        const fontSelect = document.getElementById('fontSelect');
        fontSelect.value = textObject.fontFamily;

        // Get current property values using the app's helper method
        const currentX = app.getPropertyValue(textObject, 'x');
        const currentY = app.getPropertyValue(textObject, 'y');
        const currentFontSize = app.getPropertyValue(textObject, 'fontSize');
        const currentColor = app.getPropertyValue(textObject, 'color');

        console.log('Updating UI properties for frame', app.currentFrame, {
            x: currentX,
            y: currentY,
            fontSize: currentFontSize,
            color: currentColor
        });

        // Update font size
        const fontSizeInput = document.getElementById('fontSize');
        if (fontSizeInput) {
            fontSizeInput.value = currentFontSize;
        }

        // Update color
        const colorInput = document.getElementById('fontColor');
        if (colorInput) {
            colorInput.value = currentColor;
        }

        // Update text content
        const textContentInput = document.getElementById('textContent');
        if (textContentInput) {
            textContentInput.value = textObject.text;
        }

        // Update position
        const textXInput = document.getElementById('textX');
        if (textXInput) {
            textXInput.value = currentX.toFixed(1);
        }
        
        const textYInput = document.getElementById('textY');
        if (textYInput) {
            textYInput.value = currentY.toFixed(1);
        }

        // Update variable axes
        UIManager.updateVariableAxes(textObject, app);

        // Update OpenType features
        UIManager.updateOpenTypeFeatures(textObject, app);

        // Update keyframe button states based on current frame
        UIManager.updateKeyframeButtonStates(textObject, app);
    }

    static updateVariableAxes(textObject, app) {
        const variableAxesContainer = document.getElementById('variableAxes');
        variableAxesContainer.innerHTML = '';

        if (!app.fonts.has(textObject.fontFamily)) {
            return;
        }

        const fontInfo = app.fonts.get(textObject.fontFamily);
        const axes = fontInfo.variableAxes;

        if (Object.keys(axes).length === 0) {
            return;
        }

        const title = document.createElement('h4');
        title.textContent = 'Variable Font Axes';
        title.style.cssText = `
            margin: 20px 0 12px 0;
            font-size: 13px;
            color: #ffffff;
            border-bottom: 1px solid #404040;
            padding-bottom: 6px;
        `;
        variableAxesContainer.appendChild(title);

        Object.entries(axes).forEach(([tag, axisInfo]) => {
            const axisControl = UIManager.createAxisControl(tag, axisInfo, textObject, app);
            variableAxesContainer.appendChild(axisControl);
        });
    }

    static createAxisControl(tag, axisInfo, textObject, app) {
        const control = document.createElement('div');
        control.className = 'axis-control';

        const label = document.createElement('label');
        label.textContent = `${axisInfo.name} (${tag})`;
        control.appendChild(label);

        const rangeContainer = document.createElement('div');
        rangeContainer.className = 'range-container';

        // Add keyframe button for this axis
        const keyframeBtn = document.createElement('button');
        keyframeBtn.className = 'keyframe-btn';
        const propertyName = `variableaxis:${tag}`;
        keyframeBtn.dataset.property = propertyName;
        keyframeBtn.textContent = '◆';
        keyframeBtn.title = 'Add/Remove Keyframe';
        keyframeBtn.addEventListener('click', () => {
            app.toggleKeyframe(textObject, propertyName);
        });

        const rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.min = axisInfo.min;
        rangeInput.max = axisInfo.max;
        rangeInput.step = (axisInfo.max - axisInfo.min) / 200; // More granular steps
        rangeInput.value = app.getPropertyValue(textObject, propertyName) || axisInfo.default;

        const numberInput = document.createElement('input');
        numberInput.type = 'number';
        numberInput.min = axisInfo.min;
        numberInput.max = axisInfo.max;
        numberInput.step = rangeInput.step;
        numberInput.value = rangeInput.value;

        const valueDisplay = document.createElement('span');
        valueDisplay.textContent = parseFloat(rangeInput.value).toFixed(1);

        // Sync inputs
        const updateValue = (value) => {
            rangeInput.value = value;
            numberInput.value = value;
            valueDisplay.textContent = parseFloat(value).toFixed(1);
            UIManager.updateAxisValue(propertyName, parseFloat(value), textObject, app);
        };

        rangeInput.addEventListener('input', (e) => {
            updateValue(e.target.value);
        });

        rangeInput.addEventListener('change', () => {
            app.saveState();
        });

        numberInput.addEventListener('input', (e) => {
            const value = Math.max(axisInfo.min, Math.min(axisInfo.max, parseFloat(e.target.value) || axisInfo.default));
            updateValue(value);
        });

        numberInput.addEventListener('change', () => {
            app.saveState();
        });

        // Reset button
        const resetBtn = document.createElement('button');
        resetBtn.textContent = '↺';
        resetBtn.title = 'Reset to default';
        resetBtn.style.cssText = `
            background: #404040;
            border: 1px solid #606060;
            color: #ffffff;
            width: 24px;
            height: 24px;
            border-radius: 3px;
            cursor: pointer;
            font-size: 12px;
            margin-left: 4px;
        `;
        resetBtn.addEventListener('click', () => {
            updateValue(axisInfo.default);
            app.saveState();
        });

        rangeContainer.appendChild(keyframeBtn);
        rangeContainer.appendChild(rangeInput);
        rangeContainer.appendChild(numberInput);
        rangeContainer.appendChild(valueDisplay);
        rangeContainer.appendChild(resetBtn);
        control.appendChild(rangeContainer);

        return control;
    }

    static updateAxisValue(propertyName, value, textObject, app) {
        // Set keyframe for this variable axis at current frame
        app.setKeyframe(textObject, propertyName, app.currentFrame, value);
        app.redraw();
    }

    static updateOpenTypeFeatures(textObject, app) {
        const featuresContainer = document.getElementById('openTypeFeatures');
        featuresContainer.innerHTML = '';

        if (!app.fonts.has(textObject.fontFamily)) {
            return;
        }

        const fontInfo = app.fonts.get(textObject.fontFamily);
        const features = { ...fontInfo.openTypeFeatures, ...fontInfo.stylisticSets };

        if (Object.keys(features).length === 0) {
            return;
        }

        const title = document.createElement('h4');
        title.textContent = 'OpenType Features';
        title.style.cssText = `
            margin: 20px 0 12px 0;
            font-size: 13px;
            color: #ffffff;
            border-bottom: 1px solid #404040;
            padding-bottom: 6px;
        `;
        featuresContainer.appendChild(title);

        // Sort features alphabetically by four-digit tag
        const sortedFeatures = Object.entries(features).sort(([tagA], [tagB]) => {
            return tagA.localeCompare(tagB);
        });

        // Create feature controls in alphabetical order
        sortedFeatures.forEach(([tag, featureInfo]) => {
            const featureControl = UIManager.createFeatureControl(tag, featureInfo, textObject, app);
            featuresContainer.appendChild(featureControl);
        });
    }

    static createFeatureControl(tag, featureInfo, textObject, app) {
        const control = document.createElement('div');
        control.className = 'feature-control';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `feature-${tag}-${textObject.id}`;
        checkbox.checked = textObject.openTypeFeatures && textObject.openTypeFeatures[tag] || false;

        checkbox.addEventListener('change', (e) => {
            UIManager.updateFeatureValue(tag, e.target.checked, textObject, app);
            app.saveState();
        });

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.innerHTML = `
            <span class="feature-tag">${tag}</span> ${featureInfo.name}
            ${featureInfo.description ? `<div class="feature-description">${featureInfo.description}</div>` : ''}
        `;

        control.appendChild(checkbox);
        control.appendChild(label);

        return control;
    }

    static updateFeatureValue(tag, enabled, textObject, app) {
        if (!textObject.openTypeFeatures) {
            textObject.openTypeFeatures = {};
        }
        textObject.openTypeFeatures[tag] = enabled;

        // Update current keyframe if exists
        const currentKeyframe = textObject.keyframes.find(kf => kf.frame === app.currentFrame);
        if (currentKeyframe) {
            if (!currentKeyframe.properties.openTypeFeatures) {
                currentKeyframe.properties.openTypeFeatures = {};
            }
            currentKeyframe.properties.openTypeFeatures[tag] = enabled;
        }

        app.redraw();
    }

    static updatePlayButton(isPlaying) {
        const playBtn = document.getElementById('playBtn');
        const icon = playBtn.querySelector('span');

        if (isPlaying) {
            icon.textContent = 'pause';
            playBtn.title = 'Pause (Space)';
            playBtn.classList.add('active');
        } else {
            icon.textContent = 'play_arrow';
            playBtn.title = 'Play (Space)';
            playBtn.classList.remove('active');
        }
    }

    static showExportProgress(progress) {
        const exportBtn = document.getElementById('exportBtn');
        const originalText = exportBtn.querySelector('span').textContent;

        if (progress < 1) {
            exportBtn.querySelector('span').textContent = `${Math.round(progress * 100)}%`;
            exportBtn.disabled = true;
            exportBtn.style.opacity = '0.6';
        } else {
            exportBtn.querySelector('span').textContent = originalText;
            exportBtn.disabled = false;
            exportBtn.style.opacity = '1';
        }
    }

    static createNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;

        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Auto remove
        setTimeout(() => {
            notification.style.transform = 'translateX(400px)';
            notification.style.opacity = '0';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    static showWarningModal(title, message, missingItems = []) {
        const modal = document.getElementById('warningModal');
        const modalTitle = modal.querySelector('h2');
        const modalMessage = modal.querySelector('p');
        const missingList = document.getElementById('missingFontsList');

        modalTitle.textContent = title;
        modalMessage.textContent = message;

        missingList.innerHTML = '';
        missingItems.forEach(item => {
            const li = document.createElement('li');
            li.textContent = item;
            missingList.appendChild(li);
        });

        modal.style.display = 'flex';

        return new Promise((resolve) => {
            const continueBtn = document.getElementById('continueAnyway');
            const closeBtn = modal.querySelector('.close');

            const handleClose = () => {
                modal.style.display = 'none';
                resolve();
                continueBtn.removeEventListener('click', handleClose);
                closeBtn.removeEventListener('click', handleClose);
            };

            continueBtn.addEventListener('click', handleClose);
            closeBtn.addEventListener('click', handleClose);
        });
    }

    static promptForInput(title, placeholder = '', defaultValue = '') {
        const result = prompt(title + (placeholder ? ` (${placeholder})` : ''), defaultValue);
        return Promise.resolve(result);
    }

    static confirmAction(message) {
        return Promise.resolve(confirm(message));
    }

    static updateUndoRedoButtons(app) {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');

        undoBtn.disabled = app.historyIndex <= 0;
        redoBtn.disabled = app.historyIndex >= app.history.length - 1;

        undoBtn.style.opacity = undoBtn.disabled ? '0.5' : '1';
        redoBtn.style.opacity = redoBtn.disabled ? '0.5' : '1';
    }

    static updateCanvasInfo(app) {
        // Could add canvas info display here if needed
        document.title = `Font Animation Studio - ${app.canvasWidth}×${app.canvasHeight} @ ${app.frameRate}fps`;
    }

    static showLoadingOverlay(message = 'Loading...') {
        const overlay = document.createElement('div');
        overlay.id = 'loadingOverlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2000;
            backdrop-filter: blur(4px);
        `;

        const content = document.createElement('div');
        content.style.cssText = `
            background: #2b2b2b;
            padding: 24px 32px;
            border-radius: 8px;
            text-align: center;
            color: #ffffff;
            border: 1px solid #404040;
        `;

        const spinner = document.createElement('div');
        spinner.style.cssText = `
            width: 32px;
            height: 32px;
            border: 3px solid #404040;
            border-top: 3px solid #0078d4;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 16px auto;
        `;

        const text = document.createElement('div');
        text.textContent = message;
        text.style.fontSize = '14px';

        content.appendChild(spinner);
        content.appendChild(text);
        overlay.appendChild(content);

        // Add CSS animation
        if (!document.getElementById('spinnerCSS')) {
            const style = document.createElement('style');
            style.id = 'spinnerCSS';
            style.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);
        return overlay;
    }

    static hideLoadingOverlay() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.remove();
        }
    }

    static updateKeyframeButtonStates(textObject, app) {
        if (!textObject) return;

        document.querySelectorAll('.keyframe-btn').forEach(btn => {
            const property = btn.dataset.property;
            if (property) {
                const hasKeyframe = app.hasKeyframe(textObject, property, app.currentFrame);

                // Be explicit about adding/removing the class instead of using toggle
                if (hasKeyframe) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }
}

// Make UIManager available globally
window.UIManager = UIManager;