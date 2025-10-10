// Enhanced tools management with improved interaction and visual feedback
class ToolsManager {
    constructor(app) {
        this.app = app;
        this.tools = {
            select: {
                name: 'Select',
                icon: '→',
                cursor: 'default',
                description: 'Select and move objects'
            },
            text: {
                name: 'Text',
                icon: 'T',
                cursor: 'text',
                description: 'Add new text objects'
            },
            move: {
                name: 'Move',
                icon: '⊡',
                cursor: 'move',
                description: 'Move objects'
            },
            rotate: {
                name: 'Rotate',
                icon: '↻',
                cursor: 'crosshair',
                description: 'Rotate objects'
            },
            scale: {
                name: 'Scale',
                icon: '⤢',
                cursor: 'nw-resize',
                description: 'Scale objects'
            },
            pan: {
                name: 'Pan',
                icon: '✋',
                cursor: 'grab',
                description: 'Pan the canvas'
            }
        };

        this.selectedTool = 'select';
        this.setupToolbar();
        this.setupKeyboardShortcuts();
    }

    setupToolbar() {
        const toolbar = document.querySelector('.toolbar');
        if (!toolbar) {
            console.error('Toolbar element not found');
            return;
        }

        // Clear existing tools
        toolbar.innerHTML = '';

        // Create tool buttons
        Object.entries(this.tools).forEach(([toolId, tool]) => {
            const button = this.createToolButton(toolId, tool);
            toolbar.appendChild(button);
        });

        // Select default tool
        this.selectTool('select');
    }

    createToolButton(toolId, tool) {
        const button = document.createElement('button');
        button.className = 'tool-button';
        button.dataset.tool = toolId;
        button.title = `${tool.name} - ${tool.description}`;

        // Create icon element
        const icon = document.createElement('span');
        icon.className = 'tool-icon';
        icon.textContent = tool.icon;

        // Create label element
        const label = document.createElement('span');
        label.className = 'tool-label';
        label.textContent = tool.name;

        button.appendChild(icon);
        button.appendChild(label);

        // Add click handler
        button.addEventListener('click', () => {
            this.selectTool(toolId);
        });

        // Add hover effects
        button.addEventListener('mouseenter', () => {
            this.showToolTooltip(button, tool);
        });

        button.addEventListener('mouseleave', () => {
            this.hideToolTooltip();
        });

        return button;
    }

    selectTool(toolId) {
        if (!this.tools[toolId]) {
            console.warn(`Unknown tool: ${toolId}`);
            return;
        }

        // Update selected tool
        this.selectedTool = toolId;
        this.app.selectedTool = toolId;

        // Update button states
        const buttons = document.querySelectorAll('.tool-button');
        buttons.forEach(button => {
            button.classList.toggle('active', button.dataset.tool === toolId);
        });

        // Update canvas cursor
        this.updateCanvasCursor();

        // Notify other components
        this.app.emit('toolChanged', { tool: toolId });

        // Update status
        if (window.UIManager) {
            window.UIManager.updateStatus(`${this.tools[toolId].name} tool selected`);
        }
    }

    updateCanvasCursor() {
        const canvas = document.getElementById('canvas');
        if (canvas) {
            const tool = this.tools[this.selectedTool];
            canvas.style.cursor = tool.cursor;
        }
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (event) => {
            // Ignore if user is typing in an input
            if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
                return;
            }

            const shortcuts = {
                'KeyV': 'select',    // V for selection
                'KeyT': 'text',      // T for text
                'KeyM': 'move',      // M for move
                'KeyR': 'rotate',    // R for rotate
                'KeyS': 'scale',     // S for scale
                'KeyH': 'pan',       // H for hand/pan
                'Escape': 'select'   // Escape to selection
            };

            const toolId = shortcuts[event.code] || shortcuts[event.key];
            if (toolId) {
                event.preventDefault();
                this.selectTool(toolId);
            }
        });
    }

    showToolTooltip(button, tool) {
        // Remove existing tooltip
        this.hideToolTooltip();

        const tooltip = document.createElement('div');
        tooltip.className = 'tool-tooltip';
        tooltip.innerHTML = `
            <div class="tooltip-title">${tool.name}</div>
            <div class="tooltip-description">${tool.description}</div>
            <div class="tooltip-shortcut">Shortcut: ${this.getToolShortcut(tool.name)}</div>
        `;

        document.body.appendChild(tooltip);

        // Position tooltip
        const rect = button.getBoundingClientRect();
        tooltip.style.left = (rect.right + 10) + 'px';
        tooltip.style.top = rect.top + 'px';

        this.currentTooltip = tooltip;

        // Auto-hide after delay
        this.tooltipTimeout = setTimeout(() => {
            this.hideToolTooltip();
        }, 3000);
    }

    hideToolTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.remove();
            this.currentTooltip = null;
        }

        if (this.tooltipTimeout) {
            clearTimeout(this.tooltipTimeout);
            this.tooltipTimeout = null;
        }
    }

    getToolShortcut(toolName) {
        const shortcuts = {
            'Select': 'V',
            'Text': 'T',
            'Move': 'M',
            'Rotate': 'R',
            'Scale': 'S',
            'Pan': 'H'
        };
        return shortcuts[toolName] || '';
    }

    // Tool-specific handlers
    handleCanvasClick(pos, event) {
        switch (this.selectedTool) {
            case 'select':
                return this.handleSelectClick(pos, event);
            case 'text':
                return this.handleTextClick(pos, event);
            case 'move':
                return this.handleMoveClick(pos, event);
            case 'rotate':
                return this.handleRotateClick(pos, event);
            case 'scale':
                return this.handleScaleClick(pos, event);
            case 'pan':
                return this.handlePanClick(pos, event);
        }
    }

    handleSelectClick(pos, event) {
        const clickedObject = this.app.canvasManager.getObjectAtPosition(pos);

        if (clickedObject) {
            this.app.setSelectedObject(clickedObject);
            return { action: 'select', object: clickedObject };
        } else {
            this.app.setSelectedObject(null);
            return { action: 'deselect' };
        }
    }

    handleTextClick(pos, event) {
        // Show text input dialog
        this.showTextInputDialog(pos);
        return { action: 'text-input', position: pos };
    }

    handleMoveClick(pos, event) {
        const clickedObject = this.app.canvasManager.getObjectAtPosition(pos);

        if (clickedObject) {
            this.app.setSelectedObject(clickedObject);
            return { action: 'move-start', object: clickedObject, position: pos };
        }

        return null;
    }

    handleRotateClick(pos, event) {
        const clickedObject = this.app.canvasManager.getObjectAtPosition(pos);

        if (clickedObject) {
            this.app.setSelectedObject(clickedObject);
            return { action: 'rotate-start', object: clickedObject, position: pos };
        }

        return null;
    }

    handleScaleClick(pos, event) {
        const clickedObject = this.app.canvasManager.getObjectAtPosition(pos);

        if (clickedObject) {
            this.app.setSelectedObject(clickedObject);
            // Store original font size for scaling reference
            clickedObject.baseFontSize = clickedObject.fontSize;
            return { action: 'scale-start', object: clickedObject, position: pos };
        }

        return null;
    }

    handlePanClick(pos, event) {
        // Pan functionality would be implemented here
        // For now, just show that pan is active
        return { action: 'pan-start', position: pos };
    }

    showTextInputDialog(pos) {
        // Create modal dialog for text input
        const dialog = document.createElement('div');
        dialog.className = 'text-input-dialog';
        dialog.innerHTML = `
            <div class="dialog-backdrop"></div>
            <div class="dialog-content">
                <h3>Add Text</h3>
                <input type="text" id="text-input" placeholder="Enter text..." maxlength="500">
                <div class="dialog-buttons">
                    <button id="cancel-text">Cancel</button>
                    <button id="add-text" class="primary">Add Text</button>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        const textInput = dialog.querySelector('#text-input');
        const cancelBtn = dialog.querySelector('#cancel-text');
        const addBtn = dialog.querySelector('#add-text');

        // Focus input
        textInput.focus();

        // Handle cancel
        const closeDialog = () => {
            dialog.remove();
        };

        cancelBtn.addEventListener('click', closeDialog);
        dialog.querySelector('.dialog-backdrop').addEventListener('click', closeDialog);

        // Handle add text
        const addText = () => {
            const text = textInput.value.trim();
            if (text) {
                this.createTextObject(text, pos);
            }
            closeDialog();
        };

        addBtn.addEventListener('click', addText);
        textInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                addText();
            } else if (event.key === 'Escape') {
                closeDialog();
            }
        });
    }

    createTextObject(text, pos) {
        const textObject = this.app.createTextObject(text, pos.x, pos.y);
        this.app.addTextObject(textObject);
        this.app.setSelectedObject(textObject);

        if (this.app.canvasManager) {
            this.app.canvasManager.render();
        }

        if (window.UIManager) {
            window.UIManager.updateRightPanel();
        }

        // Create initial keyframe
        if (this.app.timelineManager) {
            this.app.timelineManager.createKeyframe(textObject, this.app.currentFrame);
        }

        if (window.UIManager) {
            window.UIManager.createNotification(`Text "${text}" added`, 'success');
        }
    }

    // Get current tool info
    getCurrentTool() {
        return {
            id: this.selectedTool,
            ...this.tools[this.selectedTool]
        };
    }

    // Check if a tool requires object selection
    toolRequiresSelection(toolId = this.selectedTool) {
        return ['move', 'rotate', 'scale'].includes(toolId);
    }

    // Get tools that can create new objects
    getCreationTools() {
        return ['text'];
    }

    // Get tools that modify existing objects
    getModificationTools() {
        return ['move', 'rotate', 'scale'];
    }

    // Add custom tool
    addCustomTool(toolId, toolConfig) {
        this.tools[toolId] = {
            name: toolConfig.name || toolId,
            icon: toolConfig.icon || '?',
            cursor: toolConfig.cursor || 'default',
            description: toolConfig.description || 'Custom tool',
            ...toolConfig
        };

        // Recreate toolbar
        this.setupToolbar();
    }

    // Remove custom tool
    removeCustomTool(toolId) {
        if (this.tools[toolId]) {
            delete this.tools[toolId];

            // Switch to select tool if current tool was removed
            if (this.selectedTool === toolId) {
                this.selectTool('select');
            }

            // Recreate toolbar
            this.setupToolbar();
        }
    }

    // Get tool statistics
    getToolUsageStats() {
        // This would track tool usage in a real implementation
        return {
            selectedTool: this.selectedTool,
            availableTools: Object.keys(this.tools),
            totalTools: Object.keys(this.tools).length
        };
    }

    // Update tool states based on app state
    updateToolStates() {
        const buttons = document.querySelectorAll('.tool-button');

        buttons.forEach(button => {
            const toolId = button.dataset.tool;
            const tool = this.tools[toolId];

            // Disable tools that require selection when no object is selected
            if (this.toolRequiresSelection(toolId) && !this.app.selectedObject) {
                button.classList.add('disabled');
                button.disabled = true;
            } else {
                button.classList.remove('disabled');
                button.disabled = false;
            }
        });
    }

    // Clean up
    destroy() {
        this.hideToolTooltip();

        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeyDown);

        // Clear toolbar
        const toolbar = document.querySelector('.toolbar');
        if (toolbar) {
            toolbar.innerHTML = '';
        }
    }
}

// Make ToolsManager available globally
window.ToolsManager = ToolsManager;