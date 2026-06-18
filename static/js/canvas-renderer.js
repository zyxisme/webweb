export class CanvasRenderer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.domTree = null;
        this.viewport = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            scrollTop: 0,
            scrollLeft: 0
        };
        this.devicePixelRatio = window.devicePixelRatio || 1;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * this.devicePixelRatio;
        this.canvas.height = rect.height * this.devicePixelRatio;
        this.ctx.scale(this.devicePixelRatio, this.devicePixelRatio);

        this.viewport.width = rect.width;
        this.viewport.height = rect.height;

        this.render();
    }

    render() {
        if (!this.domTree) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.viewport.width, this.viewport.height);

        // Set white background
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height);

        // Render DOM tree
        this.renderNode(this.domTree, 0, 0);
    }

    renderNode(node, parentX, parentY) {
        if (!node) return;

        const { node_type, node_name, computed_style, box_model, children } = node;

        // Skip non-element nodes (except text)
        if (node_type !== 1 && node_type !== 3) return;

        // Text node
        if (node_type === 3) {
            this.renderText(node, parentX, parentY);
            return;
        }

        // Element node
        if (computed_style && box_model) {
            const { display, visibility, opacity } = computed_style;

            // Skip hidden elements
            if (display === 'none' || visibility === 'hidden' || opacity === '0') {
                return;
            }

            // Calculate position with scroll offset applied
            const x = parentX + (box_model.content[0] || 0) - this.viewport.scrollLeft;
            const y = parentY + (box_model.content[1] || 0) - this.viewport.scrollTop;
            const width = box_model.width || 0;
            const height = box_model.height || 0;

            // Skip off-screen elements
            if (x + width < this.viewport.x ||
                x > this.viewport.x + this.viewport.width ||
                y + height < this.viewport.y ||
                y > this.viewport.y + this.viewport.height) {
                return;
            }

            // Render element
            this.renderElement(node, x, y, width, height);

            // Render children (pass unscrolled parent position for relative layout)
            if (children) {
                const parentAbsX = parentX + (box_model.content[0] || 0);
                const parentAbsY = parentY + (box_model.content[1] || 0);
                children.forEach(child => {
                    this.renderNode(child, parentAbsX, parentAbsY);
                });
            }
        } else {
            // No style info, just render children
            if (children) {
                children.forEach(child => {
                    this.renderNode(child, parentX, parentY);
                });
            }
        }
    }

    renderElement(node, x, y, width, height) {
        const { computed_style } = node;

        // Background
        if (computed_style.background_color &&
            computed_style.background_color !== 'rgba(0, 0, 0, 0)') {
            this.ctx.fillStyle = computed_style.background_color;
            this.ctx.fillRect(x, y, width, height);
        }

        // Border
        const borderWidth = parseFloat(computed_style.border_top_width) || 0;
        if (borderWidth > 0) {
            this.ctx.strokeStyle = computed_style.border_color || '#000000';
            this.ctx.lineWidth = borderWidth;
            this.ctx.strokeRect(x, y, width, height);
        }

        // Special elements
        this.renderSpecialElement(node, x, y, width, height);
    }

    renderSpecialElement(node, x, y, width, height) {
        const { node_name, attributes, computed_style } = node;

        // Input fields
        if (node_name === 'INPUT' || node_name === 'TEXTAREA') {
            this.ctx.strokeStyle = '#dadce0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, width, height);

            this.ctx.fillStyle = '#ffffff';
            this.ctx.fillRect(x + 1, y + 1, width - 2, height - 2);
        }

        // Buttons
        if (node_name === 'BUTTON') {
            this.ctx.fillStyle = computed_style.background_color || '#f8f9fa';
            this.ctx.fillRect(x, y, width, height);

            this.ctx.strokeStyle = '#dadce0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, width, height);
        }

        // Images
        if (node_name === 'IMG') {
            // Placeholder for image rendering
            this.ctx.fillStyle = '#f1f3f4';
            this.ctx.fillRect(x, y, width, height);

            this.ctx.strokeStyle = '#dadce0';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x, y, width, height);
        }

        // Links
        if (node_name === 'A') {
            this.ctx.fillStyle = '#1a73e8';
        }
    }

    renderText(node, parentX, parentY) {
        const { node_value, computed_style } = node;

        if (!node_value || !node_value.trim()) return;

        const fontSize = parseFloat(computed_style?.font_size) || 16;
        const fontFamily = computed_style?.font_family || 'Arial';
        const fontWeight = computed_style?.font_weight || 'normal';
        const color = computed_style?.color || '#000000';

        this.ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        this.ctx.fillStyle = color;
        this.ctx.textBaseline = 'top';

        // Apply scroll offset to text position
        const x = parentX + (node.box_model?.content[0] || 0) - this.viewport.scrollLeft;
        const y = parentY + (node.box_model?.content[1] || 0) - this.viewport.scrollTop;

        this.ctx.fillText(node_value, x, y);
    }

    setDomTree(domTree) {
        this.domTree = domTree;
        this.render();
    }

    updateViewport(x, y) {
        this.viewport.x = x;
        this.viewport.y = y;
        this.render();
    }

    updateScroll(scrollTop, scrollLeft) {
        this.viewport.scrollTop = scrollTop;
        this.viewport.scrollLeft = scrollLeft;
        this.render();
    }

    getViewport() {
        return { ...this.viewport };
    }

    destroy() {
        window.removeEventListener('resize', this.resize);
    }
}
