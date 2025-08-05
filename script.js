class InteractiveMap {
    constructor() {
        this.canvas = document.getElementById('mapCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.selectedRegions = new Set();
        this.regionColors = new Map();
        this.regionNames = new Map();
        this.hoveredRegion = null;
        this.isLoaded = false;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.createSampleMap();
        this.hideLoading();
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
        
        document.getElementById('clearAll').addEventListener('click', () => this.clearAllSelections());
        
        // Handle canvas resize
        window.addEventListener('resize', () => this.handleResize());
    }
    
    createSampleMap() {
        // Create a sample map with colored regions representing different countries/areas
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Background
        this.ctx.fillStyle = '#87CEEB'; // Sky blue for water
        this.ctx.fillRect(0, 0, width, height);
        
        // Define regions with colors and approximate positions
        const regions = [
            { name: 'Spain', color: '#FF6B6B', x: 100, y: 300, width: 120, height: 80 },
            { name: 'France', color: '#4ECDC4', x: 180, y: 220, width: 100, height: 100 },
            { name: 'Germany', color: '#45B7D1', x: 280, y: 180, width: 80, height: 90 },
            { name: 'Italy', color: '#96CEB4', x: 320, y: 280, width: 70, height: 130 },
            { name: 'United Kingdom', color: '#FECA57', x: 120, y: 150, width: 80, height: 60 },
            { name: 'Poland', color: '#FF9FF3', x: 380, y: 160, width: 90, height: 80 },
            { name: 'Turkey', color: '#54A0FF', x: 480, y: 300, width: 120, height: 70 },
            { name: 'Greece', color: '#5F27CD', x: 420, y: 350, width: 60, height: 80 },
            { name: 'Morocco', color: '#00D2D3', x: 50, y: 380, width: 100, height: 80 },
            { name: 'Algeria', color: '#FF6348', x: 150, y: 420, width: 140, height: 100 },
            { name: 'Egypt', color: '#2ED573', x: 450, y: 450, width: 80, height: 70 },
            { name: 'Libya', color: '#FFA502', x: 300, y: 470, width: 120, height: 80 }
        ];
        
        // Draw regions
        regions.forEach(region => {
            this.ctx.fillStyle = region.color;
            this.ctx.fillRect(region.x, region.y, region.width, region.height);
            
            // Store color-to-region mapping
            this.regionColors.set(region.color, region.name);
            this.regionNames.set(region.name, {
                color: region.color,
                bounds: { x: region.x, y: region.y, width: region.width, height: region.height }
            });
            
            // Add region labels
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                region.name, 
                region.x + region.width / 2, 
                region.y + region.height / 2
            );
        });
        
        this.isLoaded = true;
    }
    
    getPixelColor(x, y) {
        const imageData = this.ctx.getImageData(x, y, 1, 1);
        const [r, g, b] = imageData.data;
        return `rgb(${r}, ${g}, ${b})`;
    }
    
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        if (result) {
            return `rgb(${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)})`;
        }
        return hex;
    }
    
    getRegionFromPosition(x, y) {
        // Convert canvas coordinates to actual canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const canvasX = (x - rect.left) * scaleX;
        const canvasY = (y - rect.top) * scaleY;
        
        // Find region by checking if point is within bounds
        for (const [regionName, data] of this.regionNames) {
            const bounds = data.bounds;
            if (canvasX >= bounds.x && canvasX <= bounds.x + bounds.width &&
                canvasY >= bounds.y && canvasY <= bounds.y + bounds.height) {
                return regionName;
            }
        }
        return null;
    }
    
    handleClick(event) {
        if (!this.isLoaded) return;
        
        const region = this.getRegionFromPosition(event.clientX, event.clientY);
        if (region) {
            this.toggleRegionSelection(region);
        }
    }
    
    handleMouseMove(event) {
        if (!this.isLoaded) return;
        
        const region = this.getRegionFromPosition(event.clientX, event.clientY);
        
        if (region !== this.hoveredRegion) {
            this.hoveredRegion = region;
            this.redraw();
            
            // Update cursor
            this.canvas.style.cursor = region ? 'pointer' : 'default';
        }
    }
    
    handleMouseLeave() {
        if (this.hoveredRegion) {
            this.hoveredRegion = null;
            this.redraw();
            this.canvas.style.cursor = 'default';
        }
    }
    
    toggleRegionSelection(regionName) {
        if (this.selectedRegions.has(regionName)) {
            this.selectedRegions.delete(regionName);
        } else {
            this.selectedRegions.add(regionName);
        }
        
        this.updateSelectionDisplay();
        this.redraw();
    }
    
    clearAllSelections() {
        this.selectedRegions.clear();
        this.updateSelectionDisplay();
        this.redraw();
    }
    
    redraw() {
        if (!this.isLoaded) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Redraw base map
        this.drawBaseMap();
        
        // Apply visual effects for hover and selection
        this.applyVisualEffects();
    }
    
    drawBaseMap() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Background
        this.ctx.fillStyle = '#87CEEB'; // Sky blue for water
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw regions
        this.regionNames.forEach((data, regionName) => {
            const bounds = data.bounds;
            this.ctx.fillStyle = data.color;
            this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
            
            // Add region labels
            this.ctx.fillStyle = '#000';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(
                regionName, 
                bounds.x + bounds.width / 2, 
                bounds.y + bounds.height / 2
            );
        });
    }
    
    applyVisualEffects() {
        this.regionNames.forEach((data, regionName) => {
            const bounds = data.bounds;
            const isHovered = regionName === this.hoveredRegion;
            const isSelected = this.selectedRegions.has(regionName);
            
            if (isHovered || isSelected) {
                this.ctx.save();
                
                if (isSelected) {
                    // Add selection border
                    this.ctx.strokeStyle = '#2c3e50';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(bounds.x - 2, bounds.y - 2, bounds.width + 4, bounds.height + 4);
                    
                    // Add selection overlay
                    this.ctx.fillStyle = 'rgba(44, 62, 80, 0.3)';
                    this.ctx.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
                }
                
                if (isHovered) {
                    // Add hover effect
                    this.ctx.strokeStyle = '#f39c12';
                    this.ctx.lineWidth = 2;
                    this.ctx.strokeRect(bounds.x - 1, bounds.y - 1, bounds.width + 2, bounds.height + 2);
                }
                
                this.ctx.restore();
            }
        });
    }
    
    updateSelectionDisplay() {
        const countElement = document.getElementById('selectedCount');
        const listElement = document.getElementById('selectedRegions');
        const clearButton = document.getElementById('clearAll');
        
        countElement.textContent = this.selectedRegions.size;
        
        // Update selected regions list
        listElement.innerHTML = '';
        this.selectedRegions.forEach(regionName => {
            const li = document.createElement('li');
            li.textContent = regionName;
            li.style.borderLeftColor = this.regionNames.get(regionName).color;
            listElement.appendChild(li);
        });
        
        // Enable/disable clear button
        clearButton.disabled = this.selectedRegions.size === 0;
    }
    
    handleResize() {
        // Handle canvas resizing while maintaining aspect ratio
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const aspectRatio = this.canvas.height / this.canvas.width;
        
        this.canvas.style.width = containerWidth + 'px';
        this.canvas.style.height = (containerWidth * aspectRatio) + 'px';
    }
    
    hideLoading() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
}

// Initialize the interactive map when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new InteractiveMap();
});